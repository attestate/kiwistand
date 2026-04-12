import { writeFileSync } from "fs";
import { join } from "path";

import { listSitemapMonths, listSitemapEntries } from "./cache.mjs";
import { getSlug } from "./utils.mjs";
import log from "./logger.mjs";

const PUBLIC_DIR = "src/public";
const BASE_URL = "https://news.kiwistand.com";

function buildMonthlySitemap(month) {
  const entries = listSitemapEntries(month);
  const urls = entries.map((entry) => {
    const slug = getSlug(entry.title);
    const loc = `${BASE_URL}/stories/${slug}?index=0x${entry.index}`;
    const lastmod = new Date(entry.timestamp * 1000)
      .toISOString()
      .split("T")[0];
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

function buildSitemapIndex(months) {
  const entries = [
    `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc></sitemap>`,
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

const STATIC_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE_URL}/new?cached=true</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>
  <url><loc>${BASE_URL}/best</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${BASE_URL}/guidelines</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`;

export function generateSitemaps() {
  const months = listSitemapMonths();

  for (const month of months) {
    const xml = buildMonthlySitemap(month);
    writeFileSync(join(PUBLIC_DIR, `sitemap-${month}.xml`), xml);
  }

  writeFileSync(join(PUBLIC_DIR, "sitemap-static.xml"), STATIC_SITEMAP);
  writeFileSync(join(PUBLIC_DIR, "sitemap.xml"), buildSitemapIndex(months));

  log(`Generated sitemaps for ${months.length} months`);
}
