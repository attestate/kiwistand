// @format
// Data for the /weekly archive: the top stories of each ISO week, picked like
// the Sunday newsletter (src/digest.mjs) so the page and the email agree.
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

import * as isoweek from "./isoweek.mjs";
import * as ens from "./ens.mjs";
import * as moderation from "./views/moderation.mjs";
import { getWeekStories, getNeighbourTimestamps, listWeeks } from "./cache.mjs";
import { getSummary } from "./summaries.mjs";
import { isCloudflareImage } from "./utils.mjs";
import log from "./logger.mjs";

export const STORIES_PER_WEEK = 20;
// Extra candidates so moderation can drop some and still leave 20.
const CANDIDATES = 40;

const INTRO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "content/weekly",
);

export function hostname(href) {
  try {
    const { protocol, hostname } = new URL(href);
    if (!["http:", "https:"].includes(protocol)) return null;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch (err) {
    return null;
  }
}

// Applies the feeds' moderation (banned links and profiles, title and link
// overrides, ChainPatrol) and, like the newsletter, leaves out image uploads.
export function selectStories(candidates, policy, amount = STORIES_PER_WEEK) {
  return moderation
    .moderate(candidates, policy, "/best")
    .filter(({ href }) => !isCloudflareImage(href))
    .slice(0, amount);
}

// The optional editorial intro in src/content/weekly/<YYYY>-W<ww>.md, as
// plain-text paragraphs (separated by blank lines). It's rendered as text, so
// markdown syntax isn't interpreted.
export function parseIntro(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function readIntro(week, dir = INTRO_DIR) {
  try {
    const text = await readFile(
      path.join(dir, `${isoweek.format(week)}.md`),
      "utf-8",
    );
    const paragraphs = parseIntro(text);
    return paragraphs.length ? paragraphs : null;
  } catch (err) {
    if (err.code !== "ENOENT") {
      log(`weekly: couldn't read intro for ${isoweek.format(week)}: ${err}`);
    }
    return null;
  }
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Sources with at least two stories that week, most frequent first.
export function topSources(stories, amount = 3) {
  const counts = new Map();
  for (const story of stories) {
    const host = hostname(story.href);
    if (host) counts.set(host, (counts.get(host) || 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, amount)
    .map(([host]) => host);
}

// A factual intro for weeks without an editorial one.
export function autoIntro(week, stories, isCurrent = false) {
  const comments = stories.reduce((sum, story) => sum + story.comments, 0);
  const what =
    stories.length === 1
      ? "The top story"
      : `The ${stories.length} top stories`;
  const when = isCurrent
    ? `so far this week (${isoweek.longRange(week)})`
    : `from ${isoweek.longRange(week)}`;
  let text = `${what} on Kiwi News ${when}, ranked by upvotes, comments and clicks, with ${plural(comments, "comment")} in total.`;
  const sources = topSources(stories);
  if (sources.length) text += ` Most-shared sources: ${sources.join(", ")}.`;
  return text;
}

export async function getWeek(week, isCurrent = false) {
  const { start, end } = isoweek.range(week);
  const candidates = getWeekStories(start, end, CANDIDATES);
  if (candidates.length === 0) return null;

  const policy = await moderation.getLists();
  const selected = selectStories(candidates, policy);
  if (selected.length === 0) return null;

  // NOTE: Never generates summaries (no scheduleSummary): the story pages do
  // that, this page only shows the ones that exist.
  const stories = await Promise.all(
    selected.map(async (story) => {
      const submitter = await ens.resolve(story.identity);
      return {
        ...story,
        displayName: submitter.displayName,
        summary: getSummary(story.index),
      };
    }),
  );

  const neighbours = getNeighbourTimestamps(start, end);
  const previous = neighbours.previous
    ? isoweek.weekOf(neighbours.previous)
    : null;
  const next =
    neighbours.next && !isCurrent ? isoweek.weekOf(neighbours.next) : null;
  const intro = await readIntro(week);
  return { week, isCurrent, stories, previous, next, intro };
}

// All weeks with stories, newest first (only past and current weeks exist).
export function getWeeks(now = Date.now()) {
  const current = isoweek.current(now);
  return listWeeks()
    .map((row) => ({ ...row, week: isoweek.weekOf(row.start) }))
    .filter(({ week }) => isoweek.compare(week, current) <= 0);
}
