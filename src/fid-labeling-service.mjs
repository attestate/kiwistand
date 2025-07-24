#!/usr/bin/env node
//@format

import "dotenv/config";
import { env } from "process";
import { labelNewFids } from "./fid-labels.mjs";
import log from "./logger.mjs";

const INTERVAL_HOURS = parseInt(env.FID_LABELING_INTERVAL_HOURS || "6");

async function main() {
  log(`FID Labeling Service started - runs every ${INTERVAL_HOURS} hours`);
  
  // Run immediately on startup
  try {
    await labelNewFids();
  } catch (err) {
    log(`Initial labeling failed: ${err.message}`);
  }
  
  // Schedule periodic runs
  setInterval(async () => {
    try {
      await labelNewFids();
    } catch (err) {
      log(`Scheduled labeling failed: ${err.message}`);
    }
  }, INTERVAL_HOURS * 60 * 60 * 1000);
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});