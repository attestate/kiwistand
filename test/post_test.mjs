// @format
import test from "ava";

import {
  POST_PREFIX,
  MAX_HREF_LENGTH,
  countCharacters,
  deriveTitle,
  buildPostHref,
  parsePostHref,
  getPost,
  isPost,
  isPostImage,
  validatePost,
  splitLinks,
} from "../src/web/src/post.mjs";

const IMAGE =
  "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/0b1c2d3e-4f50-6172-8394-a5b6c7d8e900/public";
const LONG =
  "Sunrise at the lake before day two of Devconnect. Spent breakfast reading the Glamsterdam EIP list: ePBS and block-level access lists in one fork is ambitious.";

test("countCharacters counts graphemes, not UTF-16 units", (t) => {
  t.is(countCharacters("hello"), 5);
  t.is(countCharacters("👍🏽"), 1);
  t.is(countCharacters("👨‍👩‍👧"), 1);
  t.is(countCharacters("é"), 1);
  t.is(countCharacters(""), 0);
});

test("deriveTitle keeps short text and joins lines", (t) => {
  t.is(deriveTitle("  gm\n\nfrenz  "), "gm frenz");
  t.is(deriveTitle("a".repeat(80)), "a".repeat(80));
});

test("deriveTitle cuts long text at a word boundary with an ellipsis", (t) => {
  const title = deriveTitle(LONG);
  t.is(title, "Sunrise at the lake before day two of Devconnect. Spent breakfast reading the…");
  t.true(Array.from(title).length <= 80);
  t.true(LONG.startsWith(title.slice(0, -1)));
});

test("deriveTitle hard-cuts text without spaces and never exceeds 80", (t) => {
  const title = deriveTitle("x".repeat(150));
  t.is(title, "x".repeat(79) + "…");
  const emoji = deriveTitle("🥝".repeat(120));
  t.is(Array.from(emoji).length, 80);
});

test("buildPostHref and parsePostHref round-trip text and picture", (t) => {
  const href = buildPostHref("Hello\r\nworld & friends? 100%", IMAGE);
  t.true(href.startsWith(POST_PREFIX));
  t.is(
    decodeURIComponent(href.slice(POST_PREFIX.length)),
    `Hello\nworld & friends? 100%\n\n${IMAGE}`,
  );
  t.deepEqual(parsePostHref(href), {
    text: "Hello\nworld & friends? 100%",
    image: IMAGE,
  });
  t.deepEqual(parsePostHref(buildPostHref(" just text ")), {
    text: "just text",
    image: null,
  });
});

test("parsePostHref only accepts Kiwi's own Cloudflare pictures", (t) => {
  const foreign = `${POST_PREFIX}${encodeURIComponent(
    "hi\n\nhttps://imagedelivery.net/OTHERACCOUNT/abc/public",
  )}`;
  t.is(parsePostHref(foreign).image, null);
  t.false(isPostImage(`${IMAGE}?x=1`));
  t.false(isPostImage(IMAGE.replace("/public", "/w=100")));
  t.false(isPostImage(IMAGE.replace("https://", "http://")));
  t.true(isPostImage(IMAGE));
});

test("parsePostHref rejects links and broken encodings", (t) => {
  t.is(parsePostHref("https://example.com"), null);
  t.is(parsePostHref("data:text/plain,%E0%A4%A"), null);
  t.is(parsePostHref(undefined), null);
});

test("isPost tells posts from old title + body text posts", (t) => {
  const href = buildPostHref(LONG, IMAGE);
  t.true(isPost({ title: deriveTitle(LONG), href }));
  t.deepEqual(getPost({ title: deriveTitle(LONG), href }), {
    text: LONG,
    image: IMAGE,
  });
  // An old text post: its own title and a separate body.
  t.false(
    isPost({ title: "My thoughts on rollups", href: buildPostHref(LONG) }),
  );
  t.false(isPost({ title: "Example", href: "https://example.com" }));
  t.false(isPost({ title: "", href: `${POST_PREFIX}` }));
});

test("validatePost checks length, picture and encoded size", (t) => {
  t.false(validatePost("   ").ok);
  const ok = validatePost("gm", IMAGE);
  t.true(ok.ok);
  t.is(ok.remaining, 198);
  t.is(ok.title, "gm");
  t.is(ok.href, buildPostHref("gm", IMAGE));

  t.true(validatePost("a".repeat(200)).ok);
  const long = validatePost("a".repeat(201));
  t.false(long.ok);
  t.is(long.remaining, -1);

  t.false(validatePost("gm", "https://example.com/cat.png").ok);

  // 200 graphemes that encode to far more than 2048 characters.
  const heavy = "👨‍👩‍👧".repeat(200);
  const result = validatePost(heavy);
  t.is(result.count, 200);
  t.true(result.href.length > MAX_HREF_LENGTH);
  t.false(result.ok);
  t.regex(result.error, /too long/);
});

test("splitLinks finds http(s) links and leaves punctuation as text", (t) => {
  t.deepEqual(splitLinks("Read https://eips.ethereum.org/EIPS/eip-7702. Wow"), [
    { text: "Read " },
    {
      href: "https://eips.ethereum.org/EIPS/eip-7702",
      display: "eips.ethereum.org/EIPS/eip-7702",
    },
    { text: ". Wow" },
  ]);
  t.deepEqual(splitLinks("no links, javascript:alert(1)"), [
    { text: "no links, javascript:alert(1)" },
  ]);
  const [link] = splitLinks("https://www.example.com/a/very/long/path/that/goes/on");
  t.is(link.display, "example.com/a/very/long/path/th…");
});
