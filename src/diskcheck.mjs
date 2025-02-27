// @format
import { execSync } from "child_process";

import log from "./logger.mjs";

export default function discCheck() {
  // Simple disk space check
  const dfOutput = execSync("df -h").toString();
  const sda1Line = dfOutput
    .split("\n")
    .find((line) => line.includes("/dev/sda1"));

  if (sda1Line) {
    const usageMatch = sda1Line.match(/(\d+)%/);
    const usagePercent = parseInt(usageMatch[1], 10);
    log(`Disk usage on /dev/sda1: ${usagePercent}%`);

    if (usagePercent >= 95) {
      log("CRITICAL: Disk space critically low!");
      process.exit(1);
    }
  } else {
    log("No diskcheck because /dev/sda1 not found");
  }
}
