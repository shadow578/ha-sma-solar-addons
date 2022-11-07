import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { register as registerBridgeEndpoint } from "./BridgeEndpoint";

//#region parse env
const {
    SMA_COOLDOWN,
    SMA_DEBUG_REQUESTS
} = process.env;
console.log(`SMA_COOLDOWN = '${SMA_COOLDOWN}'`);
console.log(`SMA_DEBUG_REQUESTS = '${SMA_DEBUG_REQUESTS}'`);

let cooldown = Number(SMA_COOLDOWN);
if (!cooldown || isNaN(cooldown) || cooldown <= 0) {
    cooldown = 60;
    console.log(`invalid cooldown reset to ${cooldown}`);
}

const debugRequests = SMA_DEBUG_REQUESTS?.toLocaleLowerCase() === "true";
//#endregion

// create and initialize express app
const app = express();
registerBridgeEndpoint(app, "/bridge", cooldown, debugRequests);

// start listening
app.listen(8080);
console.log(`app listening on ${8080}`);
