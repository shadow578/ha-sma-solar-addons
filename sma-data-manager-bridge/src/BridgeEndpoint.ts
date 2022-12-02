import { AxiosError } from "axios";
import { Express, json as expressJson } from "express";
import { ChannelValues, TimeValuePair } from "./sma/Model";
import SMAClient from "./sma/SMAClient";

const STATUS_KEY = "bridge_status";
const MESSAGE_KEY = "bridge_status_message";

/**
 * register the SMA Data Manager to REST bridge api
 * 
 * @param app the express instance
 * @param uri uri of the api endpoint
 * @param printRequests print all request bodies to console, for debugging
 * @param noHTTPErrorCodes disable http error codes, use 200 OK always
 */
export function register(app: Express,
    uri: string,
    cooldown: number = 60,
    printRequests: boolean = false,
    noHTTPErrorCodes: boolean = false) {

    let lastQueryTime: Date | undefined;
    let lastQueryValues: ChannelValues[] | undefined;
    let cachedClient: SMAClient | undefined;

    app.use(expressJson());
    app.post<any, any, ResponseBody, RequestBody>(uri, async (request, response) => {
        if (printRequests) {
            console.log(request.body);
        }

        //#region validate request body
        const body = request.body;
        if (typeof (body.host) !== "string"
            || typeof (body.username) !== "string"
            || typeof (body.password) !== "string"
            || (typeof (body.no_warning_on_fallback) !== "undefined" && typeof (body.no_warning_on_fallback) !== "boolean")
            || !Array.isArray(body.query)
            || body.query.length === 0
            || !body.query.every(qi =>
                typeof (qi.component) === "string"
                && typeof (qi.channel) === "string"
                && (qi.alias === undefined || typeof (qi.alias) === "string"))) {
            // request body is invalid
            response.status(noHTTPErrorCodes ? 200 : 400).send({
                [STATUS_KEY]: "invalid request",
                [MESSAGE_KEY]: "the request body was not valid"
            });
            return;
        }

        // there cannot be two query entries with equal component and channel
        for (const [index, qi] of body.query.entries()) {
            let i = body.query.findIndex((sqi) => qi.channel === sqi.channel && qi.component == sqi.component);
            if (i !== index) {
                response.status(noHTTPErrorCodes ? 200 : 400).send({
                    [STATUS_KEY]: "invalid query",
                    [MESSAGE_KEY]: `query item ${qi.component}::${qi.channel} is duplicate`
                });
                return;
            }
        }
        //#endregion

        //#region cooldown check
        let serveFromCache = false;
        let remainingCooldown = 0;
        const now = new Date();
        if (lastQueryTime) {
            let timeDelta = ((now.getTime() - lastQueryTime.getTime()) / 1000);
            serveFromCache = (timeDelta < cooldown);
            remainingCooldown = Math.floor(cooldown - timeDelta);
        }
        //#endregion

        let values: ChannelValues[] | undefined = undefined;
        if (!serveFromCache) {
            //#region execute the query
            const query = body.query.map(({ component: componentId, channel: channelId }) => ({ componentId, channelId }));

            // try with a cached client first
            let sma = cachedClient;
            if (sma) {
                try {
                    values = await sma.getLiveMeasurements(query);
                } catch (err) {
                    console.error(`sma query from cached client failed: ${err})`);
                    try {
                        await sma.logout();
                    } catch (_) { }
                }
            }

            // if cached client failed, try a new one
            if (!sma || values === undefined || values.length === 0) {
                sma = new SMAClient(body.host);
                cachedClient = sma;
                let didLogin = false;
                try {
                    // login
                    await sma.login(body.username, body.password);
                    didLogin = true;

                    // transform query
                    const query = body.query.map(({ component: componentId, channel: channelId }) => ({ componentId, channelId }));

                    // execute the query
                    values = await sma.getLiveMeasurements(query);
                } catch (err) {
                    // check if hostname was not found
                    let details = "unknown error";
                    if (err instanceof Error && err.message.includes("ENOTFOUND")) {
                        details = `host ${body.host} could not be resolved`;
                    }
                    if (err instanceof AxiosError && err.code === "ERR_BAD_REQUEST" && !didLogin) {
                        details = `login failed`;
                    }

                    // generic error
                    console.error(`sma query failed: ${err} (${details})`);
                    response.status(noHTTPErrorCodes ? 200 : 500).send({
                        [STATUS_KEY]: "request failed",
                        [MESSAGE_KEY]: `request failed: ${details}`
                    });
                    return;
                }
            }
            lastQueryTime = now;
            //#endregion
        } else {
            // serve cached values
            values = lastQueryValues;
        }

        // check there are now values
        if (values === undefined || values.length === 0) {
            response.status(noHTTPErrorCodes ? 200 : 500).send({
                [STATUS_KEY]: "no results",
                [MESSAGE_KEY]: `request failed: empty result`
            });
            return;
        }
        lastQueryValues = values;

        // send sesponse
        const { responseBody, hasWarnings } = prepareResponseBody(body.query, values, body.no_warning_on_fallback || false);
        responseBody[STATUS_KEY] = `${serveFromCache ? "CACHE" : "LIVE"} ${hasWarnings ? "with warnings" : ""}`;
        if (serveFromCache) {
            responseBody[MESSAGE_KEY] += `next request allowed in ${remainingCooldown} seconds`;
        }

        response.status(200).send(responseBody);
    });
}

/**
 * prepare the response body
 * 
 * @param query the query items to apply to the response
 * @param values values returned by the SMA api
 * @param noWarningOnFallback disable warnings when a fallback value was used
 * @returns the prepared response body (without RESPONSE_KEY) + metadata
 */
function prepareResponseBody(query: ChannelQueryItem[], values: ChannelValues[], noWarningOnFallback: boolean): { responseBody: ResponseBody, hasWarnings: boolean; } {
    let hasWarnings = false;
    const responseBody: ResponseBody = {
        [MESSAGE_KEY]: ""
    };

    //#region transform query result
    values.forEach(v => {
        // find corrosponding query for this value
        let qe = query.find(qi => qi.component === v.componentId && qi.channel === v.channelId);

        // resolve the value of this entry, with fallback
        let value = qe?.fallback;
        if (v.values.length > 0 && v.values[0].value !== undefined) {
            value = v.values[0].value;
        }

        // skip if no value
        if (value === undefined) {
            return;
        }

        // try to find alias, fallback to channel id
        let alias = qe?.alias || v.channelId;

        // the alias must not be equal to the status key
        if (responseBody[alias] !== undefined) {
            hasWarnings = true;
            responseBody[MESSAGE_KEY] += `alias ${alias} for ${v.componentId}::${v.channelId} is duplicate; `;
            alias = v.channelId;
        }

        // write item to the response
        responseBody[alias] = value;
    });
    //#endregion

    //#region validate all requested values are present
    query.forEach(qi => {
        let v = values!!.find(vi => vi.componentId == qi.component && vi.channelId == qi.channel);
        if (v === undefined) {
            hasWarnings = true;
            responseBody[MESSAGE_KEY] += `${qi.component}::${qi.channel} was not found; `;
        } else if (v.values.length === 0 || v.values[0].value === undefined) {
            // ignore if fallback is set and noWarningOnFallback
            if (qi.fallback !== undefined && noWarningOnFallback) {
                return;
            }

            hasWarnings = true;
            responseBody[MESSAGE_KEY] += `${qi.component}::${qi.channel} had no value; `;
        }
    });
    //#endregion

    return { responseBody, hasWarnings };
}


interface RequestBody {
    host: string,
    username: string,
    password: string,
    no_warning_on_fallback?: boolean,
    query: ChannelQueryItem[];
}

interface ChannelQueryItem {
    component: string,
    channel: string,
    alias?: string,
    fallback?: string | number;
}

type ResponseBody = Record<string, string | number>;
