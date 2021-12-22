// @format
import test from "ava";

import { init } from "../src/network.mjs";
import config from "../src/config.mjs";

test("launching an node", async t => {
  init(config);
  t.pass();
});
