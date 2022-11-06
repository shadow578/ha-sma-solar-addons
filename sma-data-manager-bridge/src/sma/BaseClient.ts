import { AxiosInstance, AxiosResponse, default as axioscl } from "axios";
import https from "https";
import * as CookieParser from "set-cookie-parser";
import { AuthTokenInfo as AuthInfo } from "./Model";

/**
 * base class for sma data manager client, handles core functionality
 */
export default abstract class SMABaseClient {
    /**
     * the current auth info, undefined if not logged in
     */
    protected authData: AuthInfo | undefined;

    /**
     * the current session id, undefined if not logged in
     */
    protected sessionId: string | undefined;

    /**
     * axios client to use for requests to $host/api/v1
     */
    protected api: AxiosInstance;

    /**
     * create a new sma client
     * 
     * @param host the host name or ip on which the sma data manager is reachable, without http:// or https://
     * @param useSsl use ssl for the connection?
     * @param verifySsl verify certificate validity when using ssl
     */
    constructor(
        private host: string,
        useSsl: boolean = true,
        verifySsl: boolean = false
    ) {
        this.api = axioscl.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: verifySsl
            }),
            baseURL: `${useSsl ? "https" : "http"}://${host}/api/v1`
        });
    }

    /**
     * get auth and host origin headers
     * only valid if logged in
     */
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    protected get authHeaders(): any {
        this.requireSession();
        return {
            ...this.originHeaders,
            "Authorization": `Bearer ${this.authData?.access_token!!}`,
            "Cookie": `JSESSIONID=${this.sessionId}`
        };
    }

    /**
     * get host origin headers
     */
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    protected get originHeaders(): any {
        return {
            "Origin": this.api.defaults.baseURL,
            "Host": this.host
        };
    }

    /**
     * update the session id from the cookies in the given response
     * 
     * @param response the response to parse the session id cookie from
     */
    protected updateSessionId(response: AxiosResponse) {
        // skip if no cookie header is present
        if (!response.headers["set-cookie"]) {
            return;
        }

        // parse session id cookie
        const s = CookieParser.parse(response.headers["set-cookie"], { decodeValues: false })
            .find(c => c.name.toLowerCase() === "jsessionid")?.value;

        // if a session was attached, update the current one
        if (s) {
            this.sessionId = s;
        }
    }

    /**
     * ensure that the client has a valid session
     */
    protected requireSession() {
        if (!this.authData || !this.authData.access_token || !this.sessionId) {
            throw new Error("session not available");
        }
    }
}
