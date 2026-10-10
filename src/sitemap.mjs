import { writeFileSync, renameSync } from "fs";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";

import { listSitemapMonths, listSitemapEntries, listWeeks } from "./cache.mjs";
import { getSlug } from "./utils.mjs";
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

export function buildSitemapIndex(months) {
  const entries = [
    `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc></sitemap>`,
    `  <sitemap><loc>${BASE_URL}/sitemap-weekly.xml</loc></sitemap>`,
    ...months.map(
      (month) =>
        `  <sitemap><loc>${BASE_URL}/sitemap-${month}.xml</loc></sitemap>`,
    ),
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

export function generateSitemaps() {
  const months = listSitemapMonths();
  const lastComments = latestCommentTimestamps();

  for (const month of months) {
    const xml = buildMonthlySitemap(listSitemapEntries(month), lastComments);
    writeAtomic(`sitemap-${month}.xml`, xml);
  }

  writeAtomic("sitemap-static.xml", STATIC_SITEMAP);
  writeAtomic(
    "sitemap-weekly.xml",
    buildWeeklySitemap(listWeeks({ activity: true })),
  );
  writeAtomic("sitemap.xml", buildSitemapIndex(months));

  log(`Generated sitemaps for ${months.length} months`);
}
