//@format
import test from "ava";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";

import { appdir } from "../src/utils.mjs";

test("that repo contains a .env-copy file with all possible configuration options", async t => {
  const copyName = ".env-copy";
  const copyPath = resolve(appdir(), copyName);
  const content = (await readFile(copyPath)).toString();
  let assertions = 1;
  t.truthy(content);

  const name = ".env";
  const envPath = resolve(appdir(), name);

  try {
    await access(envPath, constants.F_OK);
    const envContent = (await readFile(envPath)).toString();
    const expr = new RegExp(".*=.*", "gm");
    const envMatches = envContent.match(expr);
    const copyMatches = content.match(expr);
    t.is(envMatches.length, copyMatches.length);
    assertions += 1;
  } catch {}

  const options = ["LOG_LEVEL", "NODE_ENV"];

  assertions += options.length;
  t.plan(assertions);
  for (let option of options) {
    t.true(content.includes(option), `${option} missing`);
  }
});
