import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { register as registerBridgeEndpoint } from "./BridgeEndpoint";


// create and initialize express app
const app = express();
registerBridgeEndpoint(app, "/bridge");

// start listening
app.listen(8080);
console.log(`app listening on ${8080}`);
