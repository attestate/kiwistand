//@format
import test from "ava";

import { appdir } from "../src/utils.mjs";

test("if app name returns directory", t => {
  const path = appdir();
  t.truthy(path);
  t.not(path.includes("src"));
});
