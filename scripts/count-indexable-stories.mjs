// @format
// Counts how many story pages are indexable (src/indexable.mjs), i.e. how
// many stay in the sitemaps and don't render noindex, and why. Run it on the
// server, next to the running node (the stores use WAL, so it's read-safe):
//
//   node scripts/count-indexable-stories.mjs
//   node scripts/count-indexable-stories.mjs --no-moderation   # skip the config sheet
//
// Needs CACHE_DIR from .env.
import "dotenv/config";
import { exit } from "process";

import { listSitemapMonths, listSitemapEntries } from "../src/cache.mjs";
import { listSafeSummaries } from "../src/summaries.mjs";
import { indexableEntries } from "../src/sitemap.mjs";
import {
  MIN_UPVOTES,
  MIN_COMMENTS,
  MIN_SUMMARY_LENGTH,
} from "../src/indexable.mjs";
import { getLists } from "../src/views/moderation.mjs";

const skipModeration = process.argv.includes("--no-moderation");

let policy = null;
if (!skipModeration) {
  try {
    policy = await getLists();
  } catch (err) {
    console.log(`Couldn't get moderation lists, counting without: ${err}`);
  }
}

const summaries = listSafeSummaries();
const summaryOf = (entry) => summaries.get(String(entry.index).toLowerCase());

const totals = {
  stories: 0,
  indexable: 0,
  byUpvotes: 0,
  byComments: 0,
  bySummaryOnly: 0,
  withSafeSummary: 0,
};
const perYear = {};

for (const month of listSitemapMonths()) {
  const entries = listSitemapEntries(month, policy?.addresses || []);
  const kept = indexableEntries(entries, { policy, summaries });
  const year = month.slice(0, 4);
  perYear[year] ||= { stories: 0, indexable: 0 };
  perYear[year].stories += entries.length;
  perYear[year].indexable += kept.length;
  totals.stories += entries.length;
  totals.indexable += kept.length;
  for (const entry of entries) {
    if (summaryOf(entry)) totals.withSafeSummary++;
  }
  for (const entry of kept) {
    if (entry.upvotes >= MIN_UPVOTES) totals.byUpvotes++;
    else if (entry.comments >= MIN_COMMENTS) totals.byComments++;
    else totals.bySummaryOnly++;
  }
}

const pct = (n) =>
  totals.stories ? `${((n / totals.stories) * 100).toFixed(1)}%` : "0%";
console.log(
  `Rule: upvotes >= ${MIN_UPVOTES} (incl. submitter) OR comments >= ${MIN_COMMENTS} ` +
    `OR safe summary >= ${MIN_SUMMARY_LENGTH} chars; moderated stories never` +
    (skipModeration || !policy ? " (moderation skipped)" : ""),
);
console.log(`Stories:              ${totals.stories}`);
console.log(
  `Indexable:            ${totals.indexable} (${pct(totals.indexable)})`,
);
console.log(`  by upvotes:         ${totals.byUpvotes}`);
console.log(`  by comments only:   ${totals.byComments}`);
console.log(`  by summary only:    ${totals.bySummaryOnly}`);
console.log(
  `Noindex:              ${totals.stories - totals.indexable} (${pct(
    totals.stories - totals.indexable,
  )})`,
);
console.log(`Stories with a safe summary: ${totals.withSafeSummary}`);
console.log("Per year (indexable / stories):");
for (const year of Object.keys(perYear).sort()) {
  console.log(`  ${year}: ${perYear[year].indexable} / ${perYear[year].stories}`);
}
exit(0);
