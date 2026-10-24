// @format
//
// The monthly writer leaderboard (/writers): the sites and authors whose
// links got the most upvotes on Kiwi News in a calendar month (UTC). A
// writer is the link's source (src/sourcekey.mjs), the same key as the
// "Best of" pages at /source/<key>: the site, or on platforms where many
// people publish (X and its frontends, Farcaster, Mirror, Paragraph, Medium,
// GitHub, ...) the author's handle, e.g. x.com/alice.
import { getSlug, isCloudflareImage } from "./utils.mjs";
import { sourceKey, farcasterAliases } from "./sourcekey.mjs";

export const LIMIT = 25;
export const STORIES_PER_WRITER = 3;
// NOTE: Pages with fewer entries are thin, so search engines shouldn't index
// them (early in a month, or old months with little activity).
export const MIN_INDEXABLE = 10;

// { key, label, url } of a link's writer, or null for text posts, Kiwi
// references, image and file uploads and links we can't parse.
export function writerOf(href) {
  if (isCloudflareImage(href)) return null;
  const key = sourceKey(href);
  if (!key) return null;
  return { key, label: key, url: `https://${key}` };
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

// A story's title for de-duplication: case and spacing don't matter.
function titleKey(title) {
  return String(title).toLowerCase().replace(/\s+/g, " ").trim();
}

// Keeps one story per title and per link, the most upvoted.
export function dedupe(stories) {
  const seen = new Set();
  const kept = [];
  for (const story of [...stories].sort((a, b) => b.upvotes - a.upvotes)) {
    const keys = [`t:${titleKey(story.title)}`];
    if (story.href) keys.push(`h:${story.href}`);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    kept.push(story);
  }
  return kept;
}

// Groups submissions (getBest() rows: href, title, index, upvotes,
// timestamp) by writer and ranks writers by their links' upvotes. A writer's
// stories with the same title or link (resubmissions) count once, with the
// most upvoted one. Farcaster "name" and "name.eth" are one writer, like on
// /sources (the other key is in `aliases`). Ties go to the writer with more
// stories, then alphabetically, so the order is stable.
export function leaderboard(submissions, { limit = LIMIT, storiesPer = STORIES_PER_WRITER } = {}) {
  const writers = new Map();
  for (const story of submissions || []) {
    if (!story?.index || !story?.title) continue;
    const writer = writerOf(story.href);
    if (!writer) continue;
    const entry = writers.get(writer.key) || { ...writer, stories: [] };
    entry.stories.push({
      title: story.title,
      href: story.href,
      index: story.index,
      upvotes: story.upvotes || 0,
      path: `/stories/${getSlug(story.title)}?index=0x${story.index}`,
    });
    writers.set(writer.key, entry);
  }
  const counts = new Map([...writers].map(([key, e]) => [key, e.stories.length]));
  for (const [alias, key] of farcasterAliases(counts)) {
    const entry = writers.get(key);
    entry.stories.push(...writers.get(alias).stories);
    entry.aliases = [...(entry.aliases || []), alias];
    writers.delete(alias);
  }
  return [...writers.values()]
    .map((entry) => {
      const stories = dedupe(entry.stories);
      return {
        ...entry,
        upvotes: stories.reduce((sum, story) => sum + story.upvotes, 0),
        count: stories.length,
        anchor: anchorOf(entry.key),
        stories: stories.slice(0, storiesPer),
      };
    })
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
  const entry = entries.find(
    (e) => e.key === writer.key || e.aliases?.includes(writer.key),
  );
  return entry ? `${origin}/writers?month=${monthId}#${entry.anchor}` : null;
}
