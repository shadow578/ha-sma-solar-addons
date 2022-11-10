import { AxiosError } from "axios";
import { Express, json as expressJson } from "express";
import { ChannelValues } from "./sma/Model";
import SMAClient from "./sma/SMAClient";

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
    const STATUS_KEY = "bridge_status";
    const MESSAGE_KEY = "bridge_status_message";
    const cachedClients: Record<string, SMAClient> = {};

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
        const now = new Date();
        if (lastQueryTime) {
            let timeDelta = ((now.getTime() - lastQueryTime.getTime()) / 1000);
            if (timeDelta < cooldown) {
                // still in cooldown, fail the request
                response.status(noHTTPErrorCodes ? 200 : 429).send({
                    [STATUS_KEY]: "cooldown",
                    [MESSAGE_KEY]: `too many requests, next request is allowed in ${Math.floor(cooldown - timeDelta)} seconds`
                });
                return;
            }
        }
        lastQueryTime = now;
        //#endregion

        //#region execute the query
        let values: ChannelValues[] | undefined = undefined;
        const query = body.query.map(({ component: componentId, channel: channelId }) => ({ componentId, channelId }));

        // try with a cached client first
        let sma = cachedClients[body.host];
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
            cachedClients[body.host] = sma;
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

        // check there are now values
        if (values === undefined || values.length === 0) {
            response.status(noHTTPErrorCodes ? 200 : 500).send({
                [STATUS_KEY]: "no results",
                [MESSAGE_KEY]: `request failed: empty result`
            });
            return;
        }
        //#endregion

        const responseBody: ResponseBody = {
            [STATUS_KEY]: "ok",
            [MESSAGE_KEY]: ""
        };

        //#region transform query result
        values.forEach(v => {
            // only include values that have a value
            if (v.values.length === 0 || v.values[0].value === undefined) {
                return;
            }

            // try to find alias, fallback to channel id
            let alias = body.query.find(qi => qi.component === v.componentId && qi.channel === v.channelId)?.alias || v.channelId;

            // the alias must not be equal to the status key
            if (responseBody[alias] !== undefined) {
                responseBody[STATUS_KEY] = "ok with warnings";
                responseBody[MESSAGE_KEY] += `alias ${alias} for ${v.componentId}::${v.channelId} is duplicate; `;
                alias = v.channelId;
            }

            // write item to the response
            responseBody[alias] = v.values[0].value;
        });
        //#endregion

        //#region validate all requested values are present
        body.query.forEach(qi => {
            let v = values!!.find(vi => vi.componentId == qi.component && vi.channelId == qi.channel);
            if (v === undefined) {
                responseBody[STATUS_KEY] = "ok with warnings";
                responseBody[MESSAGE_KEY] += `; ${qi.component}::${qi.channel} was not found`;
            } else if (v.values.length === 0 || v.values[0].value === undefined) {
                responseBody[STATUS_KEY] = "ok with warnings";
                responseBody[MESSAGE_KEY] += `; ${qi.component}::${qi.channel} had no value`;
            }
        });
        //#endregion

        response.status(200).send(responseBody);
    });
}

interface RequestBody {
    host: string,
    username: string,
    password: string,
    query: ChannelQueryItem[];
}

interface ChannelQueryItem {
    component: string,
    channel: string,
    alias?: string;
}

type ResponseBody = Record<string, string | number>;
