import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
const app = express();

import { ChannelValues } from "./sma/Model";
import SMAClientWrapper from "./SMAClientWrapper";

let smaw: SMAClientWrapper;


/**
 * main endpoint to offer live component data
 */
app.get<{ component_ids?: string, unique_channels_only?: boolean; }>(`/api/live-data`, async (req, res) => {
  //#region query params
  // get requested component ids
  const componentIdsStr = req.query.component_ids;
  if (typeof (componentIdsStr) !== "string") {
    console.log(`invalid component_ids received`);
    res.status(400).send();
    return;
  }

  const componentIds = JSON.parse(componentIdsStr);
  if (!Array.isArray(componentIds) || componentIds.length <= 0) {
    console.log(`empty component_ids received`);
    res.status(400).send();
    return;
  }

  // get unique only filter
  const uniqueChannelsOnly = !!req.query.unique_channels_only;
  //#endregion

  // query the requested data
  let data = await smaw.getLiveMeasurements(componentIds);

  // send response
  if (data !== undefined && data.length > 0) {
    // remove duplicate channel ids
    if (uniqueChannelsOnly) {
      let filteredData: ChannelValues[] = [];
      data.forEach(cv => {
        if (!filteredData.some(cvf => cvf.channelId === cv.channelId)) {
          filteredData.push(cv);
        }
      });
      data = filteredData;
    }

    // send the response
    res.status(200).send(
      data.flatMap(cv => {
        if (cv.values.length <= 0 || cv.values[0].value === undefined) return [];
        return [{
          componentId: cv.componentId,
          channelId: cv.channelId,
          value: cv.values[0].value,
          time: cv.values[0].time
        }];
      })
    );
  } else {
    res.status(500).send();
  }
});


async function main() {
  // get config from env
  const SMA_HOST = process.env["SMA_HOST"]!!;
  const SMA_USERNAME = process.env["SMA_USERNAME"]!!;
  const SMA_PASSWORD = process.env["SMA_PASSWORD"]!!;
  const APP_PORT = Number(process.env["APP_PORT"] || "8080");
  const COOLDOWN_SECONDS = Number(process.env["COOLDOWN_SECONDS"] || "60");
  if (!SMA_HOST
    || !SMA_USERNAME
    || !SMA_PASSWORD
    || !APP_PORT || isNaN(APP_PORT)
    || !COOLDOWN_SECONDS || isNaN(COOLDOWN_SECONDS)) {
    throw new Error("failed to load config");
  }

  // create the client
  smaw = new SMAClientWrapper(SMA_HOST, SMA_USERNAME, SMA_PASSWORD, COOLDOWN_SECONDS);

  // start listening
  app.listen(APP_PORT);
  console.log(`app listening on ${APP_PORT}`);
}
main().catch(err => {
  console.error(err);
});
