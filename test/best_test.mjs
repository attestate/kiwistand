// @format
import test from "ava";

import { getStories, MAX_PAGE } from "../src/views/best.mjs";

test("best pages past MAX_PAGE are empty without querying", async (t) => {
  t.deepEqual(await getStories(MAX_PAGE + 1, "all", ""), []);
  t.deepEqual(await getStories(100000000, "week", "example.com"), []);
});
