import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { register as registerBridgeEndpoint } from "./BridgeEndpoint";

//#region parse env
const {
    SMA_COOLDOWN,
    SMA_DEBUG_REQUESTS,
    SMA_NO_HTTP_ERROR_CODES
} = process.env;

let cooldown = Number(SMA_COOLDOWN);
if (!cooldown || isNaN(cooldown) || cooldown <= 0) {
    cooldown = 60;
    console.log(`invalid cooldown reset to ${cooldown}`);
}

const debugRequests = SMA_DEBUG_REQUESTS?.toLocaleLowerCase() === "true";
const noHTTPErrorCodes = SMA_NO_HTTP_ERROR_CODES?.toLocaleLowerCase() === "true";

console.log(`SMA_COOLDOWN = '${SMA_COOLDOWN}' : ${cooldown}`);
console.log(`SMA_DEBUG_REQUESTS = '${SMA_DEBUG_REQUESTS}' : ${debugRequests}`);
console.log(`SMA_NO_HTTP_ERROR_CODES = '${SMA_NO_HTTP_ERROR_CODES}' : ${noHTTPErrorCodes}`);
//#endregion

// create and initialize express app
const app = express();
registerBridgeEndpoint(app, "/bridge", cooldown, debugRequests, noHTTPErrorCodes);

// start listening
app.listen(8080);
console.log(`app listening on ${8080}`);
