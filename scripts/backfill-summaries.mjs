// @format
// Generates the AI summary (src/summaries.mjs) for every story that doesn't
// have one yet. Story pages only summarize when someone opens them, so old
// stories that nobody visits never get one. Run it on the server, next to the
// running node (both stores use WAL, so it's safe while the node runs):
//
//   node scripts/backfill-summaries.mjs --dry-run     # counts and a cost estimate
//   node scripts/backfill-summaries.mjs               # all stories, most upvoted first
//   node scripts/backfill-summaries.mjs --limit 200   # stop after 200 attempts
//
// Same rules as story pages: only http(s) links, the same extractor, prompt
// and failure handling (a story without usable text is stored as NULL and
// retried after RETRY_AFTER; a failed Claude request isn't stored and pauses
// the run). Needs ANTHROPIC_API_KEY and CACHE_DIR from .env.
import "dotenv/config";
import { join } from "path";
import { env, exit } from "process";
import Database from "better-sqlite3";

import { isSummarizable, needsSummary, write, PAUSE_AFTER_ERROR } from "../src/summaries.mjs";
import { generateStorySummary } from "../src/parser.mjs";
import { extractArticleCached } from "../src/lib/listen/extract.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : Infinity;
// Two at a time, like story pages, so the node keeps its share of the rate
// limit and the sites we fetch from aren't hammered.
const CONCURRENCY = 2;
// Roughly what one Haiku summary costs (about 3k input tokens with the
// article, plus thinking and the summary).
const COST_PER_SUMMARY = 0.005;

if (!env.ANTHROPIC_API_KEY && !dryRun) {
  console.error("ANTHROPIC_API_KEY is not set");
  exit(1);
}

const db = new Database(join(env.CACHE_DIR || "./cache", "database.db"), {
  readonly: true,
});
const stories = db
  .prepare(
    `SELECT s.id, s.title, s.href, COUNT(u.id) AS upvotes
     FROM submissions s LEFT JOIN upvotes u ON s.href = u.href
     GROUP BY s.href
     ORDER BY upvotes DESC, s.timestamp DESC`,
  )
  .all()
  // Submission ids carry a prefix before 0x<index>, like getBest() strips.
  .map((story) => ({ ...story, index: story.id.split("0x")[1] }))
  .filter((story) => story.index);
db.close();

const todo = stories.filter(
  (story) => isSummarizable(story.href) && needsSummary(story.index),
);
console.log(
  `${stories.length} stories, ${todo.length} need a summary ` +
    `(about $${(todo.length * COST_PER_SUMMARY).toFixed(2)} at most)`,
);
if (dryRun) exit(0);

const queue = todo.slice(0, limit);
const counts = { summarized: 0, none: 0, failed: 0 };
let done = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function summarize(story) {
  let article;
  try {
    article = await extractArticleCached(story.href);
  } catch (err) {
    // Same as story pages: no text means a NULL summary below.
  }
  for (;;) {
    try {
      return await generateStorySummary(story.title, article?.plainText);
    } catch (err) {
      console.log(
        `Claude request failed (${err.message || err}); pausing ${PAUSE_AFTER_ERROR / 60000} min`,
      );
      await sleep(PAUSE_AFTER_ERROR);
    }
  }
}

async function worker() {
  while (queue.length) {
    const story = queue.shift();
    const summary = await summarize(story);
    try {
      write(story.index, summary);
      counts[summary ? "summarized" : "none"]++;
    } catch (err) {
      counts.failed++;
      console.log(`Storing summary for ${story.index} failed: ${err}`);
    }
    if (++done % 25 === 0) console.log(`${done} done`, counts);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log("finished", counts);
exit(0);
