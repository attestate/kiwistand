// @format
// Data for the "Best of <source>" pages (/source/<key>, /sources): every
// writer or publication (src/sourcekey.mjs) with the stories Kiwi News
// readers shared from it, most upvoted first.
//
// The primary process builds this hourly while it writes the sitemaps
// (src/sitemap.mjs), from the same rows (listSitemapEntries), and stores it as
// CACHE_DIR/sources.json. HTTP workers only read that file (when it changed,
// at most once a minute), so neither source pages nor story pages run the
// aggregate query.
import { join } from "path";
import { env } from "process";
import { readFile, stat } from "fs/promises";
import { readFileSync, writeFileSync, renameSync } from "fs";

import {
  sourceKey,
  sourcePath,
  sourceName,
  describe,
  farcasterAliases,
} from "./sourcekey.mjs";
import { isIndexableStory } from "./indexable.mjs";
import * as moderation from "./views/moderation.mjs";
import { getSummary } from "./summaries.mjs";
import { getSlug } from "./utils.mjs";
import log from "./logger.mjs";

// A source page is indexable (and in sitemap-sources.xml) only with this many
// indexable stories (src/indexable.mjs); otherwise it says noindex, follow.
export const MIN_INDEXABLE_STORIES = 5;
export const MAX_STORIES = 50;
export const MAX_DISCUSSED = 5;
export const MAX_LISTED = 300;
// /sources ranks by upvotes on stories shared in this window.
export const RECENT_DAYS = 90;
const CHECK_EVERY = 60 * 1000;

export function file() {
  return join(env.CACHE_DIR || "./cache", "sources.json");
}

function hidden(entry, policy) {
  try {
    return moderation.isBanned(entry, policy);
  } catch (err) {
    // NOTE: A malformed href can't be normalized; those stories are hidden
    // from the feeds anyway.
    return true;
  }
}

function byUpvotes(a, b) {
  return (
    b.upvotes - a.upvotes ||
    b.comments - a.comments ||
    b.timestamp - a.timestamp
  );
}

function byComments(a, b) {
  return b.comments - a.comments || byUpvotes(a, b);
}

// `entries` are listSitemapEntries() rows (all months), `policy` is
// moderation.getLists()'s config (null skips moderation), `summaries` maps a
// story index to its safe summary and `lastComments` a "kiwi:0x<index>" to
// its latest comment's timestamp. Moderated stories are left out entirely, so
// a source with only moderated stories doesn't exist.
//
// Farcaster "name" and "name.eth" become one source (farcasterAliases in
// src/sourcekey.mjs); the merged-away key is in the source's `aliases`.
// Sources are ordered by upvotes on stories shared in the last RECENT_DAYS
// before `now` (unix seconds), then by all-time upvotes.
export function buildSources(
  entries,
  {
    policy = null,
    summaries = new Map(),
    lastComments = new Map(),
    now = Math.floor(Date.now() / 1000),
  } = {},
) {
  const groups = new Map();
  for (const entry of entries) {
    const key = sourceKey(entry.href);
    if (!key || hidden(entry, policy)) continue;
    const summary = summaries.get(String(entry.index).toLowerCase());
    const story = {
      index: entry.index,
      title: entry.title,
      href: entry.href,
      identity: entry.identity,
      timestamp: entry.timestamp,
      upvotes: entry.upvotes,
      comments: entry.comments,
      indexable: isIndexableStory(entry, { summary }),
    };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(story);
  }

  const counts = new Map([...groups].map(([key, list]) => [key, list.length]));
  const aliasesOf = new Map();
  for (const [alias, key] of farcasterAliases(counts)) {
    groups.get(key).push(...groups.get(alias));
    groups.delete(alias);
    aliasesOf.set(key, [...(aliasesOf.get(key) || []), alias]);
  }

  const since = now - RECENT_DAYS * 24 * 60 * 60;
  const sources = [];
  for (const [key, stories] of groups) {
    stories.sort(byUpvotes);
    const strip = ({ indexable, ...story }) => story;
    let lastmod = 0;
    for (const story of stories) {
      const comment = lastComments.get(`kiwi:0x${story.index}`) || 0;
      lastmod = Math.max(lastmod, story.timestamp, comment);
    }
    const recent = stories.filter((story) => story.timestamp >= since);
    sources.push({
      key,
      ...(aliasesOf.has(key) ? { aliases: aliasesOf.get(key) } : {}),
      stories: stories.length,
      indexable: stories.filter((story) => story.indexable).length,
      upvotes: stories.reduce((sum, story) => sum + story.upvotes, 0),
      comments: stories.reduce((sum, story) => sum + story.comments, 0),
      recentStories: recent.length,
      recentUpvotes: recent.reduce((sum, story) => sum + story.upvotes, 0),
      first: Math.min(...stories.map((story) => story.timestamp)),
      latest: Math.max(...stories.map((story) => story.timestamp)),
      lastmod,
      top: stories.slice(0, MAX_STORIES).map(strip),
      discussed: stories
        .filter((story) => story.comments > 0)
        .sort(byComments)
        .slice(0, MAX_DISCUSSED)
        .map(strip),
    });
  }
  return sources.sort(
    (a, b) =>
      b.recentUpvotes - a.recentUpvotes ||
      b.upvotes - a.upvotes ||
      b.stories - a.stories ||
      (a.key < b.key ? -1 : 1),
  );
}

export function isIndexableSource(source) {
  return !!source && source.indexable >= MIN_INDEXABLE_STORIES;
}

// The sources /sources lists, most upvoted in the last RECENT_DAYS first
// (buildSources' order): only indexable ones, so the index doesn't send
// crawlers to noindex pages.
export function listedSources(sources, amount = MAX_LISTED) {
  return sources.filter(isIndexableSource).slice(0, amount);
}

// The keys of the indexable sources in a sources.json written earlier, or
// null when there's none (for IndexNow, src/sitemap.mjs).
export function readIndexableKeys(path = file()) {
  try {
    const { sources } = JSON.parse(readFileSync(path, "utf8"));
    return new Set(sources.filter(isIndexableSource).map(({ key }) => key));
  } catch (err) {
    return null;
  }
}

// NOTE: Written to a temp file and renamed so workers never read half a file.
export function write(sources, path = file(), now = Date.now()) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ generatedAt: now, sources }));
  renameSync(tmp, path);
}

let state = { mtime: 0, list: [], byKey: new Map() };
let checked = 0;
let loading = null;

async function load(path) {
  const { mtimeMs } = await stat(path);
  if (mtimeMs === state.mtime) return;
  const { sources } = JSON.parse(await readFile(path, "utf8"));
  state = {
    mtime: mtimeMs,
    list: sources,
    byKey: byKeyOf(sources),
  };
}

// Sources by key and by their aliases, so an alias's page can redirect.
export function byKeyOf(sources) {
  const byKey = new Map();
  for (const source of sources) {
    for (const alias of source.aliases || []) byKey.set(alias, source);
  }
  for (const source of sources) byKey.set(source.key, source);
  return byKey;
}

// Re-reads sources.json when it changed, at most once per CHECK_EVERY.
// Returns the pending load, or null when there's nothing to do.
function refresh(path, now = Date.now()) {
  if (loading) return loading;
  if (now - checked < CHECK_EVERY) return null;
  checked = now;
  loading = load(path)
    .catch((err) => {
      if (err.code !== "ENOENT") log(`sources: couldn't load ${path}: ${err}`);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

// For tests.
export function reset() {
  state = { mtime: 0, list: [], byKey: new Map() };
  checked = 0;
  loading = null;
}

// Waits only for the first load; later calls get the current data while a
// changed file loads in the background.
export async function getSources(path = file()) {
  const pending = refresh(path);
  if (pending && state.mtime === 0) await pending;
  return state;
}

// For story pages: never waits. The path of the href's source page when that
// page is indexable, else null.
export function indexableSourcePath(href, path = file()) {
  refresh(path);
  const key = sourceKey(href);
  if (!key) return null;
  const source = state.byKey.get(key);
  return isIndexableSource(source)
    ? { key: source.key, path: sourcePath(source.key) }
    : null;
}

// One source page's data, or null when the source has no stories. For an
// alias (farcaster.xyz/name.eth merged into farcaster.xyz/name), `key` in the
// result is the canonical key; the caller redirects. Applies
// the feeds' current moderation (title and link overrides, ChainPatrol) to
// the listed stories and adds their safe summaries (never generates any).
export async function getSourcePage(key, { sources, policy } = {}) {
  const { byKey } = sources || (await getSources());
  const source = byKey.get(key);
  if (!source) return null;
  const lists = policy || (await moderation.getLists());
  const show = (stories) =>
    moderation.moderate(stories, lists, "/best").map((story) => ({
      ...story,
      summary: getSummary(story.index),
    }));
  const top = show(source.top);
  if (top.length === 0) return null;
  return {
    ...source,
    top,
    discussed: show(source.discussed),
    indexable: isIndexableSource(source),
  };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function date(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// A factual intro from the numbers, no LLM prose.
export function autoIntro(source) {
  const what =
    source.stories === 1 ? "One story" : `${source.stories} stories`;
  const from = describe(source.key).author
    ? `by ${sourceName(source.key)}`
    : `from ${source.key}`;
  const verb = source.stories === 1 ? "has" : "have";
  let text = `${what} ${from} ${verb} been shared on Kiwi News since ${date(
    source.first,
  )}, with ${plural(source.upvotes, "upvote")} and ${plural(
    source.comments,
    "comment",
  )} in total.`;
  if (source.latest !== source.first) {
    text += ` The latest was shared on ${date(source.latest)}.`;
  }
  const shown = source.top.length;
  text +=
    shown === source.stories
      ? ` ${source.stories === 1 ? "It is" : "They are"} listed below, most upvoted first.`
      : ` The ${shown} most upvoted are listed below.`;
  return text;
}

// The page as plain-text Markdown (/source/<key>/context) for AI assistants.
// `data` comes from getSourcePage().
export function sourceMarkdown(data, base = "https://news.kiwistand.com") {
  const lines = [
    `# Best of ${data.key} on Kiwi News`,
    "",
    `Page: ${base}${sourcePath(data.key)}`,
    "",
    autoIntro(data),
    "",
  ];
  if (data.top.some((story) => story.summary)) {
    lines.push("Summaries are AI summaries of the linked article.", "");
  }
  for (const [i, story] of data.top.entries()) {
    lines.push(
      `## ${i + 1}. ${story.title}`,
      "",
      `- Kiwi News: ${base}/stories/${getSlug(story.title)}?index=0x${story.index}`,
      `- Source: ${story.href}`,
      `- Shared ${date(story.timestamp)}, ${plural(story.upvotes, "upvote")}, ${plural(story.comments, "comment")}`,
      "",
    );
    if (story.summary) lines.push(story.summary, "");
  }
  return lines.join("\n");
}
