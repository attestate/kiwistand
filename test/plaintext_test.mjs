// @format
import test from "ava";
import { JSDOM } from "jsdom";

import { plainText } from "../src/plaintext.mjs";
import row from "../src/views/components/row.mjs";

test("plainText strips tags and decodes what DOMPurify encodes", (t) => {
  // fxtwitter's og:description: line breaks as <br>.
  t.is(
    plainText("Two takeaways<br><br>> quote & stuff <3<br>"),
    "Two takeaways\n\n> quote & stuff <3\n",
  );
  t.is(plainText("<b>bold</b><script>alert(1)</script>"), "bold");
  // One level only: a typed "&lt;" stays "&lt;".
  t.is(plainText("&amp;lt; <br>"), "&lt; \n");
  // Text without markup is left alone.
  t.is(plainText("> quote & &lt;"), "> quote & &lt;");
  t.is(plainText(undefined), undefined);
});

const story = (metadata) => ({
  index: "0001",
  href: "https://x.com/someone/status/1",
  title: "A story",
  timestamp: Math.floor(Date.now() / 1000) - 60,
  identity: "0x0000000000000000000000000000000000000001",
  displayName: "someone",
  upvotes: 1,
  upvoters: [],
  metadata,
});
const render = (metadata) => String(row(0, "/stories")(story(metadata), 0));

test("a tweet's quote line renders as > once escaped", (t) => {
  const html = render({
    ogDescription: plainText("Two takeaways<br>> quote & stuff <3"),
    twitterCreator: "@someone",
  });
  t.true(html.includes("&gt; quote &amp; stuff &lt;3"));
  t.false(html.includes("&amp;gt;"));
});

test("markup in a tweet renders as text", (t) => {
  const html = render({
    ogDescription: plainText("<img src=x onerror=alert(1)>hi") + " <script>alert(1)</script>",
    twitterCreator: `"><img src=x onerror=alert(1)>`,
    twitterAuthorAvatar: "https://example.com/a.png",
  });
  const { document } = new JSDOM(html).window;
  t.is(document.querySelectorAll("script").length, 0);
  t.is(document.querySelectorAll("[onerror]").length, 0);
});
