// @format
import { getSlug } from "./utils.mjs";

const BASE_URL = "https://news.kiwistand.com";

export function escapeXml(value) {
  return String(value ?? "")
    // NOTE: Control characters (except tab, LF, CR) are invalid in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textPostContent(href) {
  if (!href.startsWith("data:text/plain,")) return null;
  try {
    return decodeURIComponent(href.replace("data:text/plain,", ""));
  } catch (err) {
    return null;
  }
}

function describe(story) {
  const parts = [];
  const text = textPostContent(story.href);
  if (text) {
    parts.push(text.length > 500 ? `${text.slice(0, 500)}…` : text);
  } else if (/^https?:\/\//.test(story.href)) {
    parts.push(`Link: ${story.href}`);
  }
  const upvotes = Array.isArray(story.upvoters)
    ? story.upvoters.length
    : story.upvotes || 0;
  const meta = [`${upvotes} upvote${upvotes === 1 ? "" : "s"}`];
  if (typeof story.commentCount === "number") {
    meta.push(
      `${story.commentCount} comment${story.commentCount === 1 ? "" : "s"}`,
    );
  }
  if (story.displayName) meta.push(`submitted by ${story.displayName}`);
  parts.push(meta.join(", "));
  return parts.join("\n\n");
}

// Renders stories (as returned by feed.mjs' index(), i.e. the data behind
// /api/v1/feeds/hot) as an RSS 2.0 feed. Each item links to the Kiwi story
// page (discussion), the original article is in the description.
export function hotFeed(stories, now = new Date()) {
  const items = stories
    .filter((story) => story && story.index && story.title)
    .map((story) => {
      const link = `${BASE_URL}/stories/${getSlug(story.title)}?index=0x${
        story.index
      }`;
      const pubDate = story.timestamp
        ? `\n      <pubDate>${new Date(
            story.timestamp * 1000,
          ).toUTCString()}</pubDate>`
        : "";
      const creator = story.displayName
        ? `\n      <dc:creator>${escapeXml(story.displayName)}</dc:creator>`
        : "";
      return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <comments>${escapeXml(link)}</comments>${pubDate}${creator}
      <description>${escapeXml(describe(story))}</description>
    </item>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Kiwi News</title>
    <link>${BASE_URL}/</link>
    <description>Handpicked crypto news for builders, curated by the Kiwi community. Trending stories from the front page.</description>
    <language>en</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <ttl>10</ttl>
    <image>
      <url>${BASE_URL}/pwa_icon.png</url>
      <title>Kiwi News</title>
      <link>${BASE_URL}/</link>
    </image>
${items.join("\n")}
  </channel>
</rss>
`;
}
