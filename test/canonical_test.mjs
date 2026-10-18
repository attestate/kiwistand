// @format
import test from "ava";

import { canonicalFromHref } from "../src/parser.mjs";

test("reads the canonical link (blog.ethereum.org /en/ variant)", (t) => {
  t.is(
    canonicalFromHref(
      "https://blog.ethereum.org/2026/10/01/introducing-zkapi",
      "https://blog.ethereum.org/en/2026/10/01/introducing-zkapi",
    ),
    "https://blog.ethereum.org/2026/10/01/introducing-zkapi",
  );
});

test("resolves a relative canonical against the page URL", (t) => {
  t.is(
    canonicalFromHref("/posts/hello?ref=x", "https://example.com/en/posts/hello"),
    "https://example.com/posts/hello?ref=x",
  );
});

test("ignores a canonical pointing at the front page from an article", (t) => {
  t.is(canonicalFromHref("https://example.com/", "https://example.com/a/post"), undefined);
});

test("keeps a front-page canonical for the front page", (t) => {
  t.is(canonicalFromHref("https://example.com/", "https://example.com/?utm=1"), "https://example.com/");
});

test("ignores missing, empty and non-http canonicals", (t) => {
  t.is(canonicalFromHref(undefined, "https://example.com/a"), undefined);
  t.is(canonicalFromHref("", "https://example.com/a"), undefined);
  t.is(canonicalFromHref("javascript:alert(1)", "https://example.com/a"), undefined);
});
