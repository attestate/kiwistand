// @format
// Counts how many "Best of <source>" pages (/source/<key>, src/sources.mjs)
// pass the quality gate, i.e. are indexable and listed in
// sitemap-sources.xml, and prints the top sources. Run it on the server, next
// to the running node (the stores use WAL, so it's read-safe):
//
//   node scripts/count-source-pages.mjs
//   node scripts/count-source-pages.mjs --top 50
//   node scripts/count-source-pages.mjs --no-moderation   # skip the config sheet
//
// Needs CACHE_DIR from .env.
import "dotenv/config";
import { exit } from "process";

import { listSitemapMonths, listSitemapEntries } from "../src/cache.mjs";
import { listSafeSummaries } from "../src/summaries.mjs";
import {
  buildSources,
  isIndexableSource,
  MIN_INDEXABLE_STORIES,
  RECENT_DAYS,
} from "../src/sources.mjs";
import { sourcePath } from "../src/sourcekey.mjs";
import { getLists } from "../src/views/moderation.mjs";

const args = process.argv.slice(2);
const skipModeration = args.includes("--no-moderation");
const topIndex = args.indexOf("--top");
const top = topIndex === -1 ? 20 : Number(args[topIndex + 1]) || 20;

let policy = null;
if (!skipModeration) {
  try {
    policy = await getLists();
  } catch (err) {
    console.log(`Couldn't get moderation lists, counting without: ${err}`);
  }
}

const summaries = listSafeSummaries();
const entries = [];
for (const month of listSitemapMonths()) {
  entries.push(...listSitemapEntries(month, policy?.addresses || []));
}
const list = buildSources(entries, { policy, summaries });
const passing = list.filter(isIndexableSource);
const platform = (source) => source.key.includes("/");

console.log(
  `Gate: a source page is indexable with >= ${MIN_INDEXABLE_STORIES} indexable stories (src/indexable.mjs); moderated stories never count` +
    (skipModeration || !policy ? " (moderation skipped)" : ""),
);
console.log(`Stories with a source:   ${list.reduce((s, x) => s + x.stories, 0)} of ${entries.length}`);
console.log(`Sources:                 ${list.length}`);
console.log(`Source pages passing:    ${passing.length}`);
console.log(`  of them platform authors (x.com/…, paragraph.xyz/@…): ${passing.filter(platform).length}`);
console.log(
  `Thin (noindex, follow):  ${list.length - passing.length}, of them with >= 2 indexable stories: ${
    list.filter((s) => !isIndexableSource(s) && s.indexable >= 2).length
  }`,
);
const merged = list.filter((source) => source.aliases);
console.log(`Merged Farcaster name/name.eth: ${merged.length}`);
for (const source of merged) {
  console.log(`  ${source.aliases.join(", ")} -> ${source.key}`);
}
console.log(
  `\nTop ${top} sources by upvotes in the last ${RECENT_DAYS} days, as /sources ranks them (indexable stories / stories, recent upvotes, all-time upvotes, comments):`,
);
for (const source of list.slice(0, top)) {
  const gate = isIndexableSource(source) ? "✓" : "✗";
  console.log(
    `  ${gate} ${source.key.padEnd(40)} ${String(source.indexable).padStart(4)} / ${String(source.stories).padEnd(5)} ${String(source.recentUpvotes).padStart(6)} recent ${String(source.upvotes).padStart(6)} upvotes ${String(source.comments).padStart(5)} comments  https://news.kiwistand.com${sourcePath(source.key)}`,
  );
}
exit(0);
