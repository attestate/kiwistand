//@format
// Google Discover (robots max-image-preview), the Google News sitemap and the
// Farcaster mini app embed.
import test from "ava";
import htm from "htm";
import vhtml from "vhtml";

import {
  mergeRobots,
  robotsContent,
  robotsMeta,
  MAX_IMAGE_PREVIEW,
} from "../src/indexable.mjs";
import {
  buildNewsSitemap,
  buildSitemapIndex,
  escapeXml,
  indexableEntries,
  newestNewsDate,
  NEWS_MAX_URLS,
} from "../src/sitemap.mjs";
import {
  custom,
  miniAppEmbed,
  MINIAPP_BUTTON_TITLE,
} from "../src/views/components/head.mjs";

const html = htm.bind(vhtml);

const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function metaContent(page, name) {
  const match = page.match(
    new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`),
  );
  return match ? decode(match[1]) : null;
}

// --- Robots ---------------------------------------------------------------

test("mergeRobots joins directives into one list without duplicates", (t) => {
  t.is(
    mergeRobots("noindex, follow", MAX_IMAGE_PREVIEW),
    "noindex, follow, max-image-preview:large",
  );
  t.is(
    mergeRobots("noindex, follow", "Follow , noindex", null, ""),
    "noindex, follow",
  );
  t.is(mergeRobots(MAX_IMAGE_PREVIEW), "max-image-preview:large");
  t.is(mergeRobots(), "");
});

test("robotsContent: indexable pages allow large previews, weak ones merge noindex", (t) => {
  t.is(robotsContent({ indexable: true }), "max-image-preview:large");
  t.is(
    robotsContent({ indexable: false }),
    "noindex, follow, max-image-preview:large",
  );
  t.is(
    robotsContent({ indexable: true, commentIndex: "abc" }),
    "noindex, follow, max-image-preview:large",
  );
});

test("a page head gets exactly one robots meta", (t) => {
  for (const indexable of [true, false]) {
    const page = html`<head>
      ${custom()} ${robotsMeta({ indexable })}
    </head>`.toString();
    t.is(page.match(/name="robots"/g).length, 1);
    t.true(metaContent(page, "robots").includes(MAX_IMAGE_PREVIEW));
    t.is(metaContent(page, "robots").includes("noindex"), !indexable);
  }
});

// --- Google News sitemap --------------------------------------------------

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const HOUR = 60 * 60;
const at = (hoursAgo) => Math.floor(NOW / 1000) - hoursAgo * HOUR;

const entry = (index, title, hoursAgo, extra = {}) => ({
  index,
  title,
  href: `https://example.com/${index}`,
  identity: "0x0000000000000000000000000000000000000001",
  timestamp: at(hoursAgo),
  upvotes: 5,
  comments: 0,
  ...extra,
});

test("news sitemap: last 48h only, newest first, escaped titles", (t) => {
  const xml = buildNewsSitemap(
    [
      entry("aa", "Older story", 30),
      entry("bb", `Ethereum & "rollups" <2026>`, 1),
      entry("cc", "Too old", 49),
    ],
    NOW,
  );
  t.true(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  t.true(
    xml.includes(
      'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    ),
  );
  t.is(xml.match(/<url>/g).length, 2);
  t.false(xml.includes("Too old"));
  t.true(xml.indexOf("index=0xbb") < xml.indexOf("index=0xaa"));
  t.true(
    xml.includes(
      "<news:title>Ethereum &amp; &quot;rollups&quot; &lt;2026&gt;</news:title>",
    ),
  );
  t.false(xml.includes('"rollups"'));
  t.true(xml.includes("<news:name>Kiwi News</news:name>"));
  t.true(xml.includes("<news:language>en</news:language>"));
  t.true(
    xml.includes(
      `<news:publication_date>${new Date(at(1) * 1000).toISOString()}</news:publication_date>`,
    ),
  );
  t.regex(xml, /<loc>https:\/\/news\.kiwistand\.com\/stories\/[^<&"]+\?index=0xbb<\/loc>/);
  t.is(newestNewsDate(xml), "2026-10-24");
  t.is(newestNewsDate(buildNewsSitemap([], NOW)), null);
});

test("news sitemap: indexable stories only, at most 1000", (t) => {
  const entries = [
    entry("aa", "Strong", 2),
    entry("bb", "Weak", 2, { upvotes: 1 }),
    entry("cc", "Hidden by moderation", 2, {
      identity: "0x00000000000000000000000000000000000000bb",
    }),
  ];
  const policy = {
    addresses: ["0x00000000000000000000000000000000000000bb"],
    links: [],
  };
  const kept = indexableEntries(entries, { policy });
  const xml = buildNewsSitemap(kept, NOW);
  t.true(xml.includes("index=0xaa"));
  t.false(xml.includes("index=0xbb"));
  t.false(xml.includes("index=0xcc"));

  const many = Array.from({ length: NEWS_MAX_URLS + 50 }, (_, i) =>
    entry(i.toString(16).padStart(4, "0"), `Story ${i}`, 1),
  );
  t.is(buildNewsSitemap(many, NOW).match(/<url>/g).length, NEWS_MAX_URLS);
});

test("the sitemap index lists the news sitemap", (t) => {
  const index = buildSitemapIndex([], { "sitemap-news.xml": "2026-10-24" });
  t.true(
    index.includes(
      "<sitemap><loc>https://news.kiwistand.com/sitemap-news.xml</loc><lastmod>2026-10-24</lastmod></sitemap>",
    ),
  );
});

test("escapeXml escapes the five XML entities", (t) => {
  t.is(escapeXml(`a & b < c > "d" 'e'`), "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;");
});

// --- Farcaster mini app embed -------------------------------------------

test("head emits fc:miniapp and fc:frame with the mini app embed JSON", (t) => {
  const page = custom(
    "https://news.kiwistand.com/previews/abc.jpg",
    "A story",
    "",
    undefined,
    [],
    "https://news.kiwistand.com/stories/a-story?index=0xabc",
    "https://news.kiwistand.com/previews/abc-frame.jpg",
  ).toString();

  const miniapp = JSON.parse(metaContent(page, "fc:miniapp"));
  const frame = JSON.parse(metaContent(page, "fc:frame"));
  for (const embed of [miniapp, frame]) {
    t.is(embed.version, "1");
    t.is(embed.imageUrl, "https://news.kiwistand.com/previews/abc-frame.jpg");
    t.true(embed.imageUrl.length <= 1024);
    t.true([...embed.button.title].length <= 32);
    t.is(embed.button.title, MINIAPP_BUTTON_TITLE);
    t.is(embed.button.action.name, "Kiwi News");
    t.is(
      embed.button.action.url,
      "https://news.kiwistand.com/stories/a-story?index=0xabc",
    );
    t.truthy(embed.button.action.splashImageUrl);
    t.regex(embed.button.action.splashBackgroundColor, /^#[0-9a-fA-F]{6}$/);
  }
  t.is(miniapp.button.action.type, "launch_miniapp");
  t.is(frame.button.action.type, "launch_frame");
});

test("head falls back to the og image and the mini app home", (t) => {
  const page = custom().toString();
  const embed = JSON.parse(metaContent(page, "fc:miniapp"));
  t.is(embed.imageUrl, "https://news.kiwistand.com/preview.jpeg?v=2");
  t.is(embed.button.action.url, "https://news.kiwistand.com/?miniapp=true");
  t.deepEqual(
    JSON.parse(miniAppEmbed("https://x.example/i.png", "https://x.example/")),
    JSON.parse(miniAppEmbed("https://x.example/i.png", "https://x.example/", "launch_miniapp")),
  );
});

test("head exposes og:image size when known", (t) => {
  const page = custom(
    "https://news.kiwistand.com/previews/abc.jpg",
    "A story",
    "",
    undefined,
    [],
    null,
    null,
    null,
    { ogImageWidth: 1200, ogImageHeight: 630 },
  ).toString();
  t.true(page.includes('<meta property="og:image:width" content="1200"'));
  t.true(page.includes('<meta property="og:image:height" content="630"'));
  t.false(custom().toString().includes("og:image:width"));
});
