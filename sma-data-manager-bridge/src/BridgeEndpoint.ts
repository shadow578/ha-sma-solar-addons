import { AxiosError } from "axios";
import { Express, json as expressJson } from "express";
import { ChannelValues } from "./sma/Model";
import SMAClient from "./sma/SMAClient";

/**
 * register the SMA Data Manager to REST bridge api
 * 
 * @param app the express instance
 * @param uri uri of the api endpoint
 */
export function register(app: Express, uri: string, cooldown: number = 60) {
    let lastQueryTime: Date | undefined;
    const STATUS_KEY = "bridge_status";

    app.use(expressJson());
    app.post<any, any, ResponseBody, RequestBody>(uri, async (request, response) => {
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
            response.status(400).send({
                [STATUS_KEY]: "invalid request body"
            });
            return;
        }

        // there cannot be two query entries with equal component and channel
        for (const [index, qi] of body.query.entries()) {
            let i = body.query.findIndex((sqi) => qi.channel === sqi.channel && qi.component == sqi.component);
            if (i !== index) {
                response.status(400).send({
                    [STATUS_KEY]: `query item ${qi.component}::${qi.channel} is duplicate`
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
                response.status(429).send({
                    [STATUS_KEY]: `too many requests, next request is allowed in ${Math.floor(cooldown - timeDelta)} seconds`
                });
                return;
            }
        }
        lastQueryTime = now;
        //#endregion

        //#region execute the query
        const sma = new SMAClient(body.host);
        let didLogin = false;
        let values: ChannelValues[];
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
            response.status(500).send({
                [STATUS_KEY]: `request failed: ${details}`
            });
            return;
        } finally {
            try {
                await sma.logout();
            } catch (err) {
                // do not fail if logout fails
                console.error(`sma logout failed: ${err}`);
            }
        }
        //#endregion

        const responseBody: ResponseBody = {
            [STATUS_KEY]: "ok"
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
                responseBody[STATUS_KEY] += `; alias ${alias} for ${v.componentId}::${v.channelId} is duplicate`;
                alias = v.channelId;
            }

            // write item to the response
            responseBody[alias] = v.values[0].value;
        });
        //#endregion

        //#region validate all requested values are present
        body.query.forEach(qi => {
            let v = values.find(vi => vi.componentId == qi.component && vi.channelId == qi.channel);
            if (v === undefined) {
                responseBody[STATUS_KEY] += `; ${qi.component}::${qi.channel} was not found`;
            } else if (v.values.length === 0 || v.values[0].value === undefined) {
                responseBody[STATUS_KEY] += `; ${qi.component}::${qi.channel} had no value`;
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
