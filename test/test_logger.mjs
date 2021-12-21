// @format
import test from "ava";

import logger from "../src/logger.mjs";

test("if logger can be initiated", t => {
  logger.info("test");
  t.pass();
});
