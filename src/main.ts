import SMAClient from "./sma/SMAClient";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // get config from env
  const {
    SMA_HOST,
    SMA_USERNAME,
    SMA_PASSWORD
  } = process.env;
  if (!SMA_HOST || !SMA_USERNAME || !SMA_PASSWORD) {
    throw new Error("failed to load config");
  }

  // create and auth the client
  const sma = new SMAClient(SMA_HOST);
  await sma.login(SMA_USERNAME, SMA_PASSWORD);
  console.log("logged in!");

  // get live data example
  const vals = await sma.getLiveMeasurements([
    "Plant:1"
  ]);
  console.log(`got ${vals.length} values!`);
  vals.forEach(v => {
    console.log(`${v.channelId} @ ${v.componentId} == ${v.values[0].value} @ ${v.values[0].time}`);
  });


  // logout after we're finished
  await sma.logout();
  console.log("logged out");
}
main().catch(err => {
  console.error(err);
});
