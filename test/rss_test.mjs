// @format
import test from "ava";

import { hotFeed, escapeXml } from "../src/rss.mjs";

test("escapeXml escapes markup and drops invalid control characters", (t) => {
  t.is(escapeXml(`a & <b> "c" 'd'\u0001`), "a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;");
});

test("hotFeed renders RSS items linking to Kiwi story pages", (t) => {
  const index = "0".repeat(70) + "01";
  const xml = hotFeed(
    [
      {
        index,
        title: "Ethereum & friends",
        href: "https://example.com/post",
        timestamp: 1700000000,
        displayName: "alice.eth",
        upvoters: ["0x1", "0x2"],
        commentCount: 1,
      },
      {
        index: "0".repeat(70) + "02",
        title: "A text post",
        href: "data:text/plain,Hello%20world",
        timestamp: 1700000000,
        upvoters: ["0x1"],
        commentCount: 0,
      },
    ],
    new Date(1700000000000),
  );
  t.true(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  t.true(xml.includes('<rss version="2.0"'));
  t.true(xml.includes("<title>Ethereum &amp; friends</title>"));
  t.true(
    xml.includes(
      `<guid isPermaLink="true">https://news.kiwistand.com/stories/`,
    ),
  );
  t.true(xml.includes(`?index=0x${index}</link>`));
  t.true(xml.includes("<pubDate>Tue, 14 Nov 2023 22:13:20 GMT</pubDate>"));
  t.true(xml.includes("<dc:creator>alice.eth</dc:creator>"));
  t.true(xml.includes("Link: https://example.com/post"));
  t.true(xml.includes("2 upvotes, 1 comment"));
  t.true(xml.includes("Hello world"));
  t.is(xml.match(/<item>/g).length, 2);
});
