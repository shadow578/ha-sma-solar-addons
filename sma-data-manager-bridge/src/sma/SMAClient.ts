import SMABaseClient from "./BaseClient";
import { ChannelValues } from "./Model";

/**
 * api client for SMA Data Manager M
 */
export default class SMAClient extends SMABaseClient {
    //#region auth
    /**
     * log into the SMA data manager
     * 
     * @param username the username to use for login
     * @param password the password to login with
     */
    async login(username: string, password: string) {
        const tokenResponse = await this.api.post("token", {
            "grant_type": "password",
            username,
            password
        }, {
            headers: {
                ...this.originHeaders,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            }
        });

        // update session id
        this.updateSessionId(tokenResponse);
        if (!this.sessionId) {
            throw new Error("failed to get session id");
        }

        // get access token
        const token = tokenResponse.data;
        if (typeof (token.access_token) !== "string"
            || typeof (token.refresh_token) !== "string"
            || typeof (token.token_type) !== "string"
            || token.token_type.toLowerCase() !== "bearer") {
            throw new Error(`failed to login as ${username}`);
        }

        this.authData = token;
    }

    /**
     * end the session with the data manager
     */
    async logout() {
        this.requireSession();
        await this.api.delete(`refreshtoken?refreshToken=${encodeURIComponent(this.authData!!.refresh_token)}`, {
            validateStatus: status => status === 200 || status === 401
        });
    }
    //#endregion

    //#region live data
    /**
     * get live data for all channels of the requested components
     * 
     * @param componentIds the components to get live data of
     * @returns the live data for all available channels of the requested components
     */
    async getLiveMeasurements(componentIds: string[]): Promise<ChannelValues[]> {

        const payload = componentIds.map(componentId => { return { componentId }; });
        const measurementsResponse = await this.api.post("measurements/live",
            payload, {
            headers: {
                ...this.authHeaders,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        });

        // validate data format
        const data = measurementsResponse.data;
        if (!Array.isArray(data)
            || !data.every(cv =>
                typeof (cv.channelId) === "string"
                && typeof (cv.componentId) === "string"
                && Array.isArray(cv.values)
                && cv.values.every((tvp: any) =>
                    (typeof (tvp.value) === "number" || typeof (tvp.value) === "string" || typeof (tvp.value) === "undefined")
                    && typeof (tvp.time) === "string"))
        ) {
            throw new Error("failed to validate live data response");
        }

        return data;
    }
    //#endregion
}