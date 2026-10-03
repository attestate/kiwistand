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
    "OPTIMISM_CRAWLER_RPC_HOSTS",
    "RPC_HTTP_HOST",
    "DEBUG",
    "NODE_ENV",
    "BIND_ADDRESS_V4",
    "PORT",
    "IS_BOOTSTRAP_NODE",
    "USE_EPHEMERAL_ID",
    "IPV4",
    "HTTP_MESSAGES_MAX_PAGE_SIZE",
    "DATA_DIR",
    "CACHE_DIR",
    "AUTO_SYNC",
    "ROOT_ADVERTISEMENT_TIMEOUT",
    "MIN_TIMESTAMP_SECS",
    "MAX_TIMESTAMP_DELTA_SECS",
    "HTTP_PORT",
    "API_PORT",
    "TOTAL_STORIES",
    "TOTAL_USERS",
    "ENSDATA_KEY",
    "CF_IMAGES_SECRET",
    "USER_AGENT",
    "CF_API_TOKEN",
    "CF_ZONE_ID",
  ];
  try {
    await access(envPath, constants.F_OK);
  } catch (err) {
    // NOTE: Fresh checkouts and CI have no .env; tests get their env from
    // ava.environmentVariables in package.json instead.
    t.log("Skipping .env comparison as there is no .env file");
    t.is(content.match(expr).length, allOptions.length);
    return;
  }
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
    `.env-copy and required "allOptions" mismatch, copyMatches: "${copyMatches}" and allOptions: "${allOptions}"`,
  );
});
