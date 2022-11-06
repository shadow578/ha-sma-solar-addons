import { AxiosInstance, default as axioscl } from "axios";
import https from "https";
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
            "Authorization": `Bearer ${this.authData}`
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
     * ensure that the client has a valid session
     */
    protected requireSession() {
        if (!this.authData || !this.authData.access_token) {
            throw new Error("session was not logged in");
        }
    }
}
