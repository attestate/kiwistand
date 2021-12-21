//@format
import test from "ava";
import { readFile } from "fs/promises";
import { resolve } from "path";

import { appdir } from "../src/utils.mjs";

test("that repo contains a .env-copy file with all possible configuration options", async t => {
  const name = ".env-copy";
  const envPath = resolve(appdir(), name);
  const content = (await readFile(envPath)).toString();
  t.truthy(content);

  const options = ["LOG_LEVEL", "NODE_ENV"];

  t.plan(options.length + 1);
  for (let option of options) {
    t.true(content.includes(option), `${option} missing`);
  }
});
