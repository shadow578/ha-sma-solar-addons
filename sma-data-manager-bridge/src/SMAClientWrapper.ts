import { ChannelValues } from "./sma/Model";
import SMAClient from "./sma/SMAClient";

export default class SMAClientWrapper {
    private smaClient: SMAClient;
    private lastRequestTime: Date | undefined;
    private lastRequestData: ChannelValues[] | undefined;

    constructor(
        host: string,
        private username: string,
        private password: string,
        private minSecondsBetweenRequests: number,
        useSsl: boolean = true,
        verifySsl: boolean = false
    ) {
        this.smaClient = new SMAClient(host, useSsl, verifySsl);
    }

    async getLiveMeasurements(componentIds: string[]): Promise<ChannelValues[] | undefined> {
        await this.smaClient.login(this.username, this.password);
        try {
            if (this.lastRequestData === undefined || this.isRequestAllowed()) {
                console.log("refreshing data");
                this.lastRequestData = await this.smaClient.getLiveMeasurements(componentIds);
                this.lastRequestTime = new Date();
            }

            return this.lastRequestData;
        } catch (err) {
            return undefined;
        }
        finally {
            await this.smaClient.logout();
        }

    }

    isRequestAllowed(): boolean {
        let now = new Date();
        let last = this.lastRequestTime;
        if (!last || isNaN(last.getTime())) return true;
        return ((now.getTime() - last.getTime()) / 1000) >= this.minSecondsBetweenRequests;
    }
}
