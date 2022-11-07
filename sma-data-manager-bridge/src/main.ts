import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { register as registerBridgeEndpoint } from "./BridgeEndpoint";

const debugRequests = process.env["SMA_DEBUG_REQUESTS"] === "TRUE";

// create and initialize express app
const app = express();
registerBridgeEndpoint(app, "/bridge", 60, debugRequests);

// start listening
app.listen(8080);
console.log(`app listening on ${8080}`);
