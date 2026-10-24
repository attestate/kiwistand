import { writeFileSync, renameSync } from "fs";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";

import { listSitemapMonths, listSitemapEntries, listWeeks } from "./cache.mjs";
import { getSlug } from "./utils.mjs";
import { isIndexableStory } from "./indexable.mjs";
import { isBanned } from "./views/moderation.mjs";
import { listSafeSummaries } from "./summaries.mjs";
import * as sources from "./sources.mjs";
import { sourcePath } from "./sourcekey.mjs";
import * as indexnow from "./indexnow.mjs";
import * as isoweek from "./isoweek.mjs";
import log from "./logger.mjs";

const PUBLIC_DIR = "src/public";
const BASE_URL = "https://news.kiwistand.com";

// NOTE: A story page changes whenever a comment arrives, so its lastmod is the
// latest comment's timestamp. cache.mjs doesn't export its connection, so we
// open a read-only one to the same SQLite file (WAL allows concurrent readers)
// and get all values in one grouped query instead of one query per story.
let readDb;
export function latestCommentTimestamps() {
  try {
    if (!readDb) {
      readDb = new Database(join(env.CACHE_DIR, "database.db"), {
        readonly: true,
        fileMustExist: true,
      });
    }
    const rows = readDb
      .prepare(
        `SELECT submission_id, MAX(timestamp) AS lastComment
         FROM comments GROUP BY submission_id`,
      )
      .all();
    return new Map(rows.map((row) => [row.submission_id, row.lastComment]));
  } catch (err) {
    log(`Sitemap: couldn't read comment timestamps: ${err.toString()}`);
    return new Map();
  }
}

// Only stories whose pages are indexable (src/indexable.mjs): listing pages
// that say noindex would waste crawl budget and mix signals. `policy` is
// moderation.getLists()'s config (null skips moderation) and `summaries` maps
// a story index to its safe summary (summaries.listSafeSummaries()).
export function indexableEntries(
  entries,
  { policy = null, summaries = new Map() } = {},
) {
  return entries.filter((entry) => {
    let hidden = false;
    try {
      hidden = isBanned(entry, policy);
    } catch (err) {
      // NOTE: A malformed href can't be normalized; those stories are hidden
      // from the feeds anyway.
      hidden = true;
    }
    return isIndexableStory(
      { ...entry, hidden },
      { summary: summaries.get(String(entry.index).toLowerCase()) },
    );
  });
}

export function buildMonthlySitemap(entries, lastComments = new Map()) {
  const urls = entries.map((entry) => {
    const slug = getSlug(entry.title);
    const loc = `${BASE_URL}/stories/${slug}?index=0x${entry.index}`;
    const lastComment = lastComments.get(`kiwi:0x${entry.index}`);
    const modified = Math.max(entry.timestamp, lastComment || 0);
    const lastmod = new Date(modified * 1000)
      .toISOString()
      .split("T")[0];
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// The /weekly/<YYYY>-W<ww> pages, from listWeeks({ activity: true }). A
// week's lastmod is the latest submission, upvote or comment on its stories.
export function buildWeeklySitemap(weeks, now = Date.now()) {
  const current = isoweek.current(now);
  const urls = weeks
    .map((row) => ({ ...row, week: isoweek.weekOf(row.start) }))
    .filter(({ week }) => isoweek.compare(week, current) <= 0)
    .map(({ week, lastActivity }) => {
      const lastmod = new Date(lastActivity * 1000).toISOString().split("T")[0];
      return `  <url><loc>${BASE_URL}${isoweek.path(week)}</loc><lastmod>${lastmod}</lastmod></url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// The indexable source pages (src/sources.mjs) and their index, /sources.
// A source's lastmod is its latest story or comment.
export function buildSourcesSitemap(list) {
  const day = (timestamp) =>
    new Date(timestamp * 1000).toISOString().split("T")[0];
  const listed = sources.listedSources(list, Infinity);
  const urls = listed.map(
    ({ key, lastmod }) =>
      `  <url><loc>${BASE_URL}${sourcePath(key)}</loc><lastmod>${day(lastmod)}</lastmod></url>`,
  );
  if (listed.length > 0) {
    const newest = Math.max(...listed.map(({ lastmod }) => lastmod));
    urls.unshift(
      `  <url><loc>${BASE_URL}/sources</loc><lastmod>${day(newest)}</lastmod></url>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// Source pages that became indexable since the last run, for IndexNow. None
// on the first run (no earlier sources.json): the sitemap lists them all.
export function newSourceUrls(before, list) {
  if (!before) return [];
  return sources
    .listedSources(list, Infinity)
    .filter(({ key }) => !before.has(key))
    .map(({ key }) => `${BASE_URL}${sourcePath(key)}`);
}

// The newest <lastmod> in a urlset (YYYY-MM-DD strings sort by date), so the
// index can tell crawlers which child sitemaps changed since their last visit.
export function newestLastmod(xml) {
  let newest = null;
  for (const [, date] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

// `lastmods` maps a child sitemap's file name to its newest lastmod.
export function buildSitemapIndex(months, lastmods = {}) {
  const entry = (name) => {
    const lastmod = lastmods[name];
    return `  <sitemap><loc>${BASE_URL}/${name}</loc>${
      lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
    }</sitemap>`;
  };
  const entries = [
    entry("sitemap-static.xml"),
    entry("sitemap-weekly.xml"),
    entry("sitemap-sources.xml"),
    ...months.map((month) => entry(`sitemap-${month}.xml`)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;
}

export const STATIC_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE_URL}/new?cached=true</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>
  <url><loc>${BASE_URL}/best</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${BASE_URL}/weekly</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>${BASE_URL}/newsletter</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
  <url><loc>${BASE_URL}/guidelines</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`;

// NOTE: Write to a temp file and rename so HTTP workers reading the sitemaps
// never see a half-written file.
function writeAtomic(name, content) {
  const path = join(PUBLIC_DIR, name);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

// Writes CACHE_DIR/sources.json (read by the HTTP workers, src/sources.mjs)
// and sitemap-sources.xml from all months' entries, and tells IndexNow about
// source pages that just became indexable. Returns the sitemap's newest
// lastmod.
function generateSources(entries, options) {
  const list = sources.buildSources(entries, options);
  const before = sources.readIndexableKeys();
  sources.write(list);
  const xml = buildSourcesSitemap(list);
  writeAtomic("sitemap-sources.xml", xml);
  indexnow.submit(newSourceUrls(before, list));
  log(
    `Generated source pages: ${sources.listedSources(list, Infinity).length} of ${list.length} indexable`,
  );
  return newestLastmod(xml);
}

// `policy` is moderation.getLists()'s config; without it (the config sheet
// was unreachable) nothing is treated as moderated.
export function generateSitemaps(policy = null) {
  const months = listSitemapMonths();
  const lastComments = latestCommentTimestamps();
  const summaries = listSafeSummaries();
  const bannedAddresses = policy?.addresses || [];

  const lastmods = {};
  const listed = [];
  const all = [];
  let total = 0;
  let indexable = 0;
  for (const month of months) {
    const entries = listSitemapEntries(month, bannedAddresses);
    const kept = indexableEntries(entries, { policy, summaries });
    all.push(...entries);
    total += entries.length;
    indexable += kept.length;
    // NOTE: Months without an indexable story are still written (so an old
    // file doesn't linger with noindex URLs) but left out of the index.
    const xml = buildMonthlySitemap(kept, lastComments);
    writeAtomic(`sitemap-${month}.xml`, xml);
    if (kept.length === 0) continue;
    listed.push(month);
    lastmods[`sitemap-${month}.xml`] = newestLastmod(xml);
  }

  writeAtomic("sitemap-static.xml", STATIC_SITEMAP);
  const weekly = buildWeeklySitemap(listWeeks({ activity: true }));
  writeAtomic("sitemap-weekly.xml", weekly);
  lastmods["sitemap-weekly.xml"] = newestLastmod(weekly);
  try {
    lastmods["sitemap-sources.xml"] = generateSources(all, {
      policy,
      summaries,
      lastComments,
    });
  } catch (err) {
    log(`Sitemap: source pages failed: ${err.stack || err}`);
  }

  writeAtomic("sitemap.xml", buildSitemapIndex(listed, lastmods));

  log(
    `Generated sitemaps for ${listed.length} months (${indexable} of ${total} stories indexable)`,
  );
}
