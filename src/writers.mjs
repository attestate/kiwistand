// @format
//
// The monthly writer leaderboard (/writers): the sites and authors whose
// links got the most upvotes on Kiwi News in a calendar month (UTC). A
// "writer" is the link's site, except on platforms where many people publish
// (X, Farcaster, Mirror, Paragraph, Medium, GitHub, Substack-style
// subdomains stay as they are): there the author's handle in the path is the
// writer, e.g. x.com/alice.
import { getSlug, isCloudflareImage } from "./utils.mjs";

export const LIMIT = 25;
export const STORIES_PER_WRITER = 3;
// NOTE: Pages with fewer entries are thin, so search engines shouldn't index
// them (early in a month, or old months with little activity).
export const MIN_INDEXABLE = 10;

const PLATFORMS = new Map([
  ["x.com", "x.com"],
  ["twitter.com", "x.com"],
  ["mobile.twitter.com", "x.com"],
  ["farcaster.xyz", "farcaster.xyz"],
  ["warpcast.com", "farcaster.xyz"],
  ["mirror.xyz", "mirror.xyz"],
  ["paragraph.xyz", "paragraph.xyz"],
  ["paragraph.com", "paragraph.com"],
  ["medium.com", "medium.com"],
  ["github.com", "github.com"],
  ["youtube.com", "youtube.com"],
]);
const NOT_HANDLES = new Set(["i", "~", "home", "search", "explore", "watch", "channel", "p", "status"]);

// { key, label, url } of a link's writer, or null for text posts, Kiwi
// references, image uploads and links we can't parse.
export function writerOf(href) {
  if (typeof href !== "string" || !/^https?:\/\//.test(href)) return null;
  if (isCloudflareImage(href)) return null;
  let url;
  try {
    url = new URL(href);
  } catch (err) {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  const platform = PLATFORMS.get(host);
  if (platform) {
    const handle = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] || "");
    if (!handle || NOT_HANDLES.has(handle.toLowerCase()) || !/^@?[\w.-]{1,64}$/.test(handle)) {
      return null;
    }
    const name = handle.toLowerCase();
    const key = `${platform}/${name}`;
    return { key, label: key, url: `https://${platform}/${handle}` };
  }
  return { key: host, label: host, url: `https://${host}` };
}

// The HTML id of a writer's row, so casts and badges can link to it.
export function anchorOf(key) {
  return `w-${String(key).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

// "YYYY-MM" → the month's [start, end) in unix seconds. No month (or
// garbage) means the current month; months in the future are null.
export function monthRange(month, now = Date.now()) {
  const current = new Date(now);
  let year = current.getUTCFullYear();
  let index = current.getUTCMonth();
  if (month !== undefined && month !== null && month !== "") {
    const match = String(month).match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    year = Number(match[1]);
    index = Number(match[2]) - 1;
    if (index < 0 || index > 11 || year < 2023) return null;
  }
  const start = Date.UTC(year, index, 1);
  if (start > now) return null;
  const end = Date.UTC(year, index + 1, 1);
  const id = `${year}-${String(index + 1).padStart(2, "0")}`;
  const label = new Date(start).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { id, label, start: start / 1000, end: end / 1000 };
}

// Groups submissions (getBest() rows: href, title, index, upvotes,
// timestamp) by writer and ranks writers by their links' upvotes. Ties go to
// the writer with more stories, then alphabetically, so the order is stable.
export function leaderboard(submissions, { limit = LIMIT, storiesPer = STORIES_PER_WRITER } = {}) {
  const writers = new Map();
  for (const story of submissions || []) {
    if (!story?.index || !story?.title) continue;
    const writer = writerOf(story.href);
    if (!writer) continue;
    const entry = writers.get(writer.key) || { ...writer, upvotes: 0, stories: [] };
    entry.upvotes += story.upvotes || 0;
    entry.stories.push({
      title: story.title,
      index: story.index,
      upvotes: story.upvotes || 0,
      path: `/stories/${getSlug(story.title)}?index=0x${story.index}`,
    });
    writers.set(writer.key, entry);
  }
  return [...writers.values()]
    .map((entry) => ({
      ...entry,
      count: entry.stories.length,
      anchor: anchorOf(entry.key),
      stories: entry.stories.sort((a, b) => b.upvotes - a.upvotes).slice(0, storiesPer),
    }))
    .sort(
      (a, b) =>
        b.upvotes - a.upvotes || b.count - a.count || a.key.localeCompare(b.key),
    )
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

// The month's leaderboard from the database, moderated like the feeds.
// deps are for tests.
export async function getLeaderboard(range, deps = {}) {
  const getBest = deps.getBest || (await import("./cache.mjs")).getBest;
  const moderation = deps.moderation || (await import("./views/moderation.mjs"));
  const rows = getBest(5000, 0, null, "", range.start).filter(
    (story) => story.timestamp >= range.start && story.timestamp < range.end,
  );
  let policy;
  try {
    policy = await moderation.getLists();
  } catch (err) {
    policy = null;
  }
  const moderated = policy ? moderation.moderate(rows, policy, "/") : rows;
  return leaderboard(moderated);
}

// The /writers URL of the story's writer this month, or null when the
// writer isn't on the leaderboard.
export function entryUrl(entries, href, monthId, origin = "https://news.kiwistand.com") {
  const writer = writerOf(href);
  if (!writer) return null;
  const entry = entries.find((e) => e.key === writer.key);
  return entry ? `${origin}/writers?month=${monthId}#${entry.anchor}` : null;
}
