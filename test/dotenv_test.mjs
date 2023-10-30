//@format
import test from "ava";
import { env } from "process";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";

import { appdir } from "../src/utils.mjs";

test("that repo contains a .env-copy file with all possible configuration options", async (t) => {
  // NOTE: https://docs.github.com/en/actions/learn-github-actions/variables
  if (env.GITHUB_ACTIONS) {
    t.log("Skipping .env-copy test on GitHub Actions CI");
    t.pass();
    return;
  }

  const copyName = ".env-copy";
  const copyPath = resolve(appdir(), copyName);
  const content = (await readFile(copyPath)).toString();
  t.truthy(content);

  const name = ".env";
  const envPath = resolve(appdir(), name);

  const expr = new RegExp(".*=.*", "gm");
  const allOptions = [
    "OPTIMISM_RPC_HTTP_HOST",
    "LOG_LEVEL",
    "NODE_ENV",
    "BIND_ADDRESS_V4",
    "PORT",
    "IS_BOOTSTRAP_NODE",
    "USE_EPHEMERAL_ID",
    "IPV4",
    "HTTP_PORT",
    "API_PORT",
    "HTTP_MESSAGES_MAX_PAGE_SIZE",
    "DATA_DIR",
    "CACHE_DIR",
    "AUTO_SYNC",
    "ROOT_ADVERTISEMENT_TIMEOUT",
    "MIN_TIMESTAMP_SECS",
    "TIMESTAMP_TOLERANCE_SECS",
    "DEBUG",
  ];
  await access(envPath, constants.F_OK);
  const envContent = (await readFile(envPath)).toString();
  const envMatches = envContent.match(expr);
  const copyMatches = content.match(expr);
  t.is(
    envMatches.length,
    copyMatches.length,
    ".env-copy and .env aren't matching",
  );
  t.is(
    copyMatches.length,
    allOptions.length,
    ".env-copy and required `allOptions` mismatch",
  );
});
