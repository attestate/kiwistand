import test from "ava";

import { isKnownSafe } from "../src/linksafety.mjs";

test("well-known domains and their subdomains are safe", (t) => {
  t.true(isKnownSafe("https://x.com/vitalik/status/1"));
  t.true(isKnownSafe("https://www.youtube.com/watch?v=1"));
  t.true(isKnownSafe("https://vitalik.substack.com/p/post"));
  t.true(isKnownSafe("data:text/plain,hello"));
});

test("lookalike domains are not safe", (t) => {
  t.false(isKnownSafe("https://evil-x.com/login"));
  t.false(isKnownSafe("https://x.com.evil.io/login"));
  t.false(isKnownSafe("https://opensea.support/login"));
});
