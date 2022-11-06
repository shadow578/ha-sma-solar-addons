import SMABaseClient from "./BaseClient";

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
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

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

}