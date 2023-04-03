//@format
import test from "ava";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";

import { appdir } from "../src/utils.mjs";

test("that repo contains a .env-copy file with all possible configuration options", async (t) => {
  const copyName = ".env-copy";
  const copyPath = resolve(appdir(), copyName);
  const content = (await readFile(copyPath)).toString();
  t.truthy(content);

  const name = ".env";
  const envPath = resolve(appdir(), name);

  const expr = new RegExp(".*=.*", "gm");
  const allOptions = [
    "LOG_LEVEL",
    "NODE_ENV",
    "BIND_ADDRESS_V4",
    "PORT",
    "IS_BOOTSTRAP_NODE",
    "USE_EPHEMERAL_ID",
    "IPV4",
    "HTTP_PORT",
    "DATA_DIR",
    "AUTO_SYNC",
    "THEME",
    "ROOT_ADVERTISEMENT_TIMEOUT",
    "MIN_TIMESTAMP_SECS",
    "TIMESTAMP_TOLERANCE_SECS",
  ];
  await access(envPath, constants.F_OK);
  const envContent = (await readFile(envPath)).toString();
  const envMatches = envContent.match(expr);
  const copyMatches = content.match(expr);
  t.is(envMatches.length, copyMatches.length);
  t.is(
    copyMatches.length,
    allOptions.length,
    ".env-copy and required `allOptions` mismatch"
  );
});
