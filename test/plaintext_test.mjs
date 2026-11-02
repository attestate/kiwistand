// @format
import http from "http";
import { join } from "path";

import test from "ava";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import nodeFetch from "node-fetch";
import normalizeUrl from "normalize-url";

import { plainText, decodeEntities } from "../src/plaintext.mjs";
import {
  metadata,
  cachedMetadata,
  plainMetadata,
  render,
  setPageFetchForTests,
} from "../src/parser.mjs";
import cache from "../src/cache.mjs";
import row from "../src/views/components/row.mjs";
import ParagraphFullPost from "../src/views/components/paragraph-full-post.mjs";

// The row counts outbound clicks from the sqlite cache (see
// test/embed_image_size_test.mjs).
test.before(() => {
  const db = new Database(join(process.env.CACHE_DIR, "database.db"));
  db.exec(
    `CREATE TABLE IF NOT EXISTS fingerprints (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, hash TEXT NOT NULL, timestamp INTEGER NOT NULL);`,
  );
  db.close();
});

// What fxtwitter's og:description holds for a tweet with a quote line (its
// HTML has literal <br> tags and &gt;), and what DOMPurify made of it in
// the metadata cache before this change.
const quoteTweet = "Two takeaways<br><br>> quote & stuff <3<br><br>Agreed";
const cachedQuoteTweet =
  "Two takeaways<br><br>&gt; quote &amp; stuff &lt;3<br><br>Agreed";
const plainQuoteTweet = "Two takeaways\n\n> quote & stuff <3\n\nAgreed";

test("plainText decodes the basic entities", (t) => {
  t.is(plainText("a &gt; b &lt; c &amp; d"), "a > b < c & d");
  t.is(
    plainText("&quot;quoted&quot; &#39;single&#39; &apos;x&apos;"),
    `"quoted" 'single' 'x'`,
  );
  t.is(plainText("&#62; &#x3C; &#X3c; &#8230; &#x1F95D;"), "> < < … 🥝");
  t.is(plainText("a&nbsp;b"), "a\u00a0b");
});

test("plainText decodes one level only", (t) => {
  t.is(plainText("&amp;gt;"), "&gt;");
  t.is(plainText("&amp;amp;lt;"), "&amp;lt;");
  t.is(plainText("<b>&amp;gt;</b>"), "&gt;");
});

test("plainText leaves unknown or broken entities alone", (t) => {
  t.is(plainText("R&D, AT&T, a & b"), "R&D, AT&T, a & b");
  const broken = "&hellip; &gt &#0; &#xD800; &#99999999;";
  t.is(plainText(broken), broken);
  t.is(decodeEntities("&notit; &amp"), "&notit; &amp");
});

test("plainText turns <br> into line breaks and strips other tags", (t) => {
  t.is(plainText(quoteTweet), plainQuoteTweet);
  t.is(plainText(cachedQuoteTweet), plainQuoteTweet);
  t.is(plainText("a<br/>b<BR />c"), "a\nb\nc");
  t.is(
    plainText('<p>Hello <b>bold</b> <a href="x">link</a></p>'),
    "Hello bold link",
  );
});

test("plainText drops scripts and event handlers", (t) => {
  t.is(plainText("hi<script>alert(1)</script>"), "hi");
  t.is(plainText('hi<img src=x onerror="alert(1)">'), "hi");
  t.is(plainText("<style>body{}</style>ok"), "ok");
});

test("plainText leaves plain text unchanged", (t) => {
  for (const text of [
    plainQuoteTweet,
    "> quote & stuff <3",
    "a < b > c",
    `Tom's "quote"`,
    "line 1\nline 2\n\n  indented",
    "gm 🥝 https://example.com/?a=1&b=2",
    "",
  ]) {
    t.is(plainText(text), text);
    t.is(plainText(plainText(text)), text);
  }
  t.is(plainText(undefined), undefined);
  t.is(plainText(null), null);
  t.is(plainText(42), 42);
});

test("plainMetadata converts an entry cached before the change", (t) => {
  const entry = {
    domain: "fxtwitter.com",
    ogTitle: "Tom &amp; Jerry &lt;3",
    ogDescription: cachedQuoteTweet,
    twitterCreator: "@someone",
    image: "https://example.com/a.png?x=1&y=2",
    canonicalLink: "https://x.com/someone/status/1?a=1&b=2",
    farcasterCast: {
      text: "&gt; cast quote",
      author: {
        username: "someone",
        displayName: "Some &amp; One",
        pfp: "https://example.com/p.png",
      },
      embeds: [],
      hash: "0xabc",
    },
    blueskyPost: {
      text: "a &amp; b",
      author: { handle: "someone.bsky.social", displayName: "S &lt;3" },
      images: [],
    },
    paragraphPost: {
      title: "A &amp; B",
      description: "desc &gt; more",
      content: "<p>Keep &amp; this <b>HTML</b></p>",
      author: { username: "someone", displayName: "S &amp; O" },
    },
  };
  const plain = plainMetadata(entry);
  t.is(plain.ogTitle, "Tom & Jerry <3");
  t.is(plain.ogDescription, plainQuoteTweet);
  t.is(plain.twitterCreator, "@someone");
  t.is(plain.image, entry.image);
  t.is(plain.canonicalLink, entry.canonicalLink);
  t.is(plain.farcasterCast.text, "> cast quote");
  t.is(plain.farcasterCast.author.displayName, "Some & One");
  t.is(plain.farcasterCast.author.pfp, "https://example.com/p.png");
  t.is(plain.farcasterCast.hash, "0xabc");
  t.is(plain.blueskyPost.text, "a & b");
  t.is(plain.blueskyPost.author.displayName, "S <3");
  t.is(plain.paragraphPost.title, "A & B");
  t.is(plain.paragraphPost.description, "desc > more");
  t.is(plain.paragraphPost.author.displayName, "S & O");
  // The post's body is HTML (ParagraphFullPost sanitizes it).
  t.is(plain.paragraphPost.content, entry.paragraphPost.content);
  t.true(plain.plainText);
  // The cached entry itself isn't changed.
  t.is(entry.ogDescription, cachedQuoteTweet);
  t.is(entry.plainText, undefined);
});

test("plainMetadata is idempotent", (t) => {
  // A post that literally says "&lt;" (its og:description had "&amp;lt;").
  const once = plainMetadata({ ogDescription: "write &amp;lt; for <" });
  t.is(once.ogDescription, "write &lt; for <");
  t.deepEqual(plainMetadata(once), once);
  t.deepEqual(plainMetadata(plainMetadata(once)), once);
});

test("plainMetadata leaves failures, empty and missing entries alone", (t) => {
  const failure = { failed: true, error: "a &amp; b", timestamp: 1 };
  t.is(plainMetadata(failure), failure);
  const empty = {};
  t.is(plainMetadata(empty), empty);
  t.is(plainMetadata(null), null);
  t.is(plainMetadata(undefined), undefined);
  t.false("ogTitle" in plainMetadata({ domain: "example.com" }));
  t.false("farcasterCast" in plainMetadata({ domain: "example.com" }));
});

test.serial("cachedMetadata converts an old cache entry", async (t) => {
  const url = `https://plaintext-${Date.now()}.example.com/post`;
  await cache.set(normalizeUrl(url, { stripWWW: false }), {
    domain: "example.com",
    ogDescription: cachedQuoteTweet,
    canIframe: true,
  });
  const result = await cachedMetadata(url);
  t.is(result.ogDescription, plainQuoteTweet);
  t.true(result.plainText);
});

async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.teardown(() => {
    server.closeAllConnections();
    server.close();
  });
  setPageFetchForTests((url, options) => nodeFetch(url, options));
  t.teardown(() => setPageFetchForTests());
  return server.address().port;
}

const page = (title, description) =>
  `<html><head><meta property="og:title" content="${title}"/>` +
  `<meta property="og:description" content="${description}"/>` +
  `</head><body></body></html>`;

test.serial("metadata stores a description as plain text", async (t) => {
  const port = await listen(t, (req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    // As fxtwitter writes it: literal <br>, the quote line's > as &gt;.
    res.end(
      page(
        "Tom &amp; Jerry",
        "Two takeaways<br><br>&gt; quote &amp; stuff &lt;3<br><br>Agreed",
      ),
    );
  });
  const result = await metadata(`http://127.0.0.1:${port}/page-${Date.now()}`);
  t.is(result.ogDescription, plainQuoteTweet);
  t.is(result.ogTitle, "Tom & Jerry");
  t.true(result.plainText);
});

test.serial("metadata strips markup from a description", async (t) => {
  const port = await listen(t, (req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      page(
        "&lt;script&gt;alert(1)&lt;/script&gt;Title",
        "&lt;img src=x onerror=alert(1)&gt;Hi" +
          "&lt;script&gt;alert(2)&lt;/script&gt; &amp;lt;b&amp;gt; typed",
      ),
    );
  });
  const result = await metadata(`http://127.0.0.1:${port}/xss-${Date.now()}`);
  // Markup in the page is stripped; entities the author typed stay text.
  t.is(result.ogDescription, "Hi <b> typed");
  t.is(result.ogTitle, "Title");
});

const story = (href, metadata) => ({
  index: "0001",
  href,
  title: "A story",
  timestamp: Math.floor(Date.now() / 1000) - 60,
  identity: "0x0000000000000000000000000000000000000001",
  displayName: "someone",
  upvotes: 1,
  upvoters: [],
  metadata,
});

// The embed's text: the first <p> in its body.
const body = (markup, name) => {
  const start = String(markup).indexOf(`<div class="${name}-embed-body">`);
  return String(markup)
    .slice(start)
    .match(/<p[^>]*>([\s\S]*?)<\/p>/)[1];
};
const count = (text, part) => text.split(part).length - 1;

for (const [name, ogDescription] of [
  ["a plain-text description", plainQuoteTweet],
  ["a description cached before the change", cachedQuoteTweet],
]) {
  test(`a tweet's quote line renders as > from ${name}`, (t) => {
    const metadata = plainMetadata({
      ogDescription,
      twitterCreator: "@someone",
    });
    const text = body(
      row(0, "/stories")(story("https://x.com/someone/status/1", metadata), 0),
      "tweet",
    );
    t.is(count(text, "&gt;"), 1);
    t.true(text.includes("&gt; quote &amp; stuff &lt;3"));
    t.false(text.includes("&amp;gt;"));
    t.false(text.includes("&amp;amp;"));
    t.false(text.includes("&amp;lt;"));
  });
}

test("a cast's quote line renders as >", (t) => {
  const metadata = plainMetadata({
    farcasterCast: {
      text: "> quote & stuff <3",
      author: { username: "someone", displayName: "someone" },
      hash: "0xabc",
      embeds: [],
    },
  });
  const href = "https://farcaster.xyz/someone/0xabc";
  const text = body(row(0, "/stories")(story(href, metadata), 0), "farcaster");
  t.is(count(text, "&gt;"), 1);
  t.true(text.includes("&gt; quote &amp; stuff &lt;3"));
  t.false(text.includes("&amp;gt;"));
});

test("a Bluesky post renders its text escaped once", (t) => {
  const metadata = plainMetadata({
    blueskyPost: {
      text: "> quote & stuff <3",
      author: { handle: "someone.bsky.social", displayName: "someone" },
      images: [],
    },
  });
  const href = "https://bsky.app/profile/someone.bsky.social/post/3abc";
  const text = body(row(0, "/stories")(story(href, metadata), 0), "bluesky");
  t.is(count(text, "&gt;"), 1);
  t.true(text.includes("&gt; quote &amp; stuff &lt;3"));
});

test("a title with < and & is escaped once", (t) => {
  const markup = String(
    row(0, "/new")({ ...story("https://example.com/a"), title: "I <3 R&D" }, 0),
  );
  const link = markup.match(/data-story-link="[^"]*"[^>]*>([^<]*)<\/a>/)[1];
  t.is(link.trim(), "I &lt;3 R&amp;D");
});

test("markup in a tweet, cast or title renders as text", (t) => {
  const evil = "<script>alert(1)</script><img src=x onerror=alert(1)>";
  // Typed as text: the entities decode to "<script>…", which is escaped.
  const typedEntities = "&lt;script&gt;alert(1)&lt;/script&gt;";
  const typed = plainText(typedEntities);
  t.is(typed, "<script>alert(1)</script>");
  const attribute = `"&gt;&lt;img src=x onerror=alert(1)&gt;`;
  t.is(plainText(attribute), `"><img src=x onerror=alert(1)>`);
  const markups = [
    row(0, "/stories")(
      {
        ...story(
          "https://x.com/someone/status/1",
          plainMetadata({
            ogDescription: `${evil} ${typedEntities}`,
            twitterCreator: attribute,
            twitterAuthorAvatar: "https://example.com/a.png",
          }),
        ),
        title: evil,
      },
      0,
    ),
    row(0, "/stories")(
      story(
        "https://farcaster.xyz/someone/0xabc",
        plainMetadata({
          farcasterCast: {
            text: `${typedEntities} ${attribute}`,
            author: { username: attribute, pfp: "https://example.com/p.png" },
            hash: "0xabc",
            embeds: [],
          },
        }),
      ),
      0,
    ),
    row(0, "/stories")(
      story(
        "https://bsky.app/profile/someone.bsky.social/post/3abc",
        plainMetadata({
          blueskyPost: {
            text: typedEntities,
            author: { handle: attribute, avatar: "https://example.com/p.png" },
            images: [],
          },
        }),
      ),
      0,
    ),
    render(typed, "example.com", `${typed} ${plainText(attribute)}`, null),
    ParagraphFullPost({
      post: plainMetadata({
        paragraphPost: {
          title: typedEntities,
          description: attribute,
          author: { username: attribute, displayName: typedEntities },
        },
      }).paragraphPost,
    }),
  ];
  for (const markup of markups.map(String)) {
    // Parsed like a browser would: no script, no image from the text and
    // no event handler attribute.
    const { document } = new JSDOM(markup).window;
    t.is(document.querySelectorAll("script").length, 0);
    t.is(document.querySelectorAll('img[src="x"], [onerror]').length, 0);
  }
  for (const markup of markups.map(String)) {
    t.true(markup.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  }
  // The author's handle stays inside the alt attribute.
  for (const markup of markups.slice(0, 3).map(String)) {
    const { document } = new JSDOM(markup).window;
    const alts = [...document.querySelectorAll("img[alt]")].map((i) => i.alt);
    t.true(alts.includes(`"><img src=x onerror=alert(1)>`));
  }
});
