#!/usr/bin/env node
// @format
//
// Weekly traffic report from sources that have no Claude connector:
// Cloudflare (every request, incl. people who decline analytics, and
// crawlers) and Google Search Console (search queries and pages). Runs in
// GitHub Actions (.github/workflows/metrics.yml) and prints Markdown to
// stdout; each source is skipped when its credentials aren't set.
//
// Environment:
//   CLOUDFLARE_API_TOKEN   token with Account Analytics:Read + Zone Analytics:Read
//   CLOUDFLARE_ZONE_ID     zone id of kiwistand.com
//   GSC_SERVICE_ACCOUNT    service account JSON key (the service account's
//                          email must be added as a user in Search Console)
//   GSC_SITE_URL           property, e.g. "sc-domain:kiwistand.com" or
//                          "https://news.kiwistand.com/"
//   METRICS_DAYS           look-back window (default 28)
import { env } from "process";
import { createSign } from "crypto";

const days = parseInt(env.METRICS_DAYS || "28", 10);
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const since = day(days);
const until = day(0);
const lines = [`# Traffic report ${since} – ${until}`, ""];
const table = (header, rows) => [
  `| ${header.join(" | ")} |`,
  `|${header.map(() => "---").join("|")}|`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
  "",
];

async function cloudflare(query, variables) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data.viewer.zones[0];
}

async function cloudflareReport() {
  lines.push("## Cloudflare (all requests)", "");
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    lines.push("Skipped: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set.", "");
    return;
  }
  try {
    const zone = await cloudflare(
      `query ($zone: String!, $since: Date!, $until: Date!) {
        viewer { zones(filter: { zoneTag: $zone }) {
          httpRequests1dGroups(limit: 100, filter: { date_geq: $since, date_lt: $until }, orderBy: [date_ASC]) {
            dimensions { date }
            sum { requests pageViews cachedRequests threats }
            uniq { uniques }
          }
        } }
      }`,
      { zone: env.CLOUDFLARE_ZONE_ID, since, until },
    );
    // Weekly buckets, so trends are readable.
    const weeks = new Map();
    for (const { dimensions, sum, uniq } of zone.httpRequests1dGroups) {
      const date = new Date(dimensions.date);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      const key = date.toISOString().slice(0, 10);
      const week = weeks.get(key) || { requests: 0, pageViews: 0, uniques: 0, threats: 0 };
      week.requests += sum.requests;
      week.pageViews += sum.pageViews;
      week.threats += sum.threats;
      // Daily uniques summed: an upper bound for the week's visitors.
      week.uniques += uniq.uniques;
      weeks.set(key, week);
    }
    lines.push(
      ...table(
        ["week of", "page views", "daily uniques (sum)", "requests", "threats"],
        [...weeks].map(([week, w]) => [week, w.pageViews, w.uniques, w.requests, w.threats]),
      ),
    );
  } catch (err) {
    lines.push(`Error: ${err.message}`, "");
  }

  // Per-path and per-crawler numbers need the adaptive dataset, which only
  // keeps a few days on smaller plans; report the last day if it's there.
  try {
    const zone = await cloudflare(
      `query ($zone: String!, $since: Time!, $until: Time!) {
        viewer { zones(filter: { zoneTag: $zone }) {
          agents: httpRequestsAdaptiveGroups(limit: 25, filter: { datetime_geq: $since, datetime_lt: $until, requestSource: "eyeball" }, orderBy: [count_DESC]) {
            count
            dimensions { userAgent }
          }
          paths: httpRequestsAdaptiveGroups(limit: 25, filter: { datetime_geq: $since, datetime_lt: $until, requestSource: "eyeball", edgeResponseContentTypeName: "html" }, orderBy: [count_DESC]) {
            count
            dimensions { clientRequestPath }
          }
        } }
      }`,
      {
        zone: env.CLOUDFLARE_ZONE_ID,
        since: new Date(Date.now() - 86400000).toISOString(),
        until: new Date().toISOString(),
      },
    );
    const crawler = /bot|crawl|spider|gpt|claude|perplexity|anthropic|openai|bytespider|google-extended|ccbot/i;
    lines.push("### Last 24 hours: crawlers and AI agents", "");
    lines.push(
      ...table(
        ["requests", "user agent"],
        zone.agents
          .filter(({ dimensions }) => crawler.test(dimensions.userAgent))
          .map(({ count, dimensions }) => [count, dimensions.userAgent.slice(0, 120).replace(/\|/g, "/")]),
      ),
    );
    lines.push("### Last 24 hours: most requested HTML pages", "");
    lines.push(...table(["requests", "path"], zone.paths.map(({ count, dimensions }) => [count, dimensions.clientRequestPath])));
  } catch (err) {
    lines.push(`Per-path / user-agent breakdown unavailable: ${err.message}`, "");
  }
}

async function googleToken() {
  const key = JSON.parse(env.GSC_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = await response.json();
  if (!body.access_token) throw new Error(body.error_description || body.error || "no token");
  return body.access_token;
}

async function searchConsoleReport() {
  lines.push("## Google Search Console", "");
  if (!env.GSC_SERVICE_ACCOUNT || !env.GSC_SITE_URL) {
    lines.push("Skipped: GSC_SERVICE_ACCOUNT / GSC_SITE_URL not set.", "");
    return;
  }
  try {
    const token = await googleToken();
    const query = async (dimensions, rowLimit = 25) => {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.GSC_SITE_URL)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: since, endDate: until, dimensions, rowLimit }),
        },
      );
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      return body.rows || [];
    };
    const row = (r) => [
      ...r.keys.map((k) => k.replace(/\|/g, "/")),
      r.clicks,
      r.impressions,
      `${(r.ctr * 100).toFixed(1)}%`,
      r.position.toFixed(1),
    ];
    const totals = await query([], 1);
    if (totals[0]) {
      const t = totals[0];
      lines.push(
        `Clicks ${t.clicks} · impressions ${t.impressions} · CTR ${(t.ctr * 100).toFixed(1)}% · avg. position ${t.position.toFixed(1)}`,
        "",
      );
    }
    lines.push("### Top queries", "", ...table(["query", "clicks", "impressions", "CTR", "position"], (await query(["query"])).map(row)));
    lines.push("### Top pages", "", ...table(["page", "clicks", "impressions", "CTR", "position"], (await query(["page"])).map(row)));
  } catch (err) {
    lines.push(`Error: ${err.message}`, "");
  }
}

await cloudflareReport();
await searchConsoleReport();
console.log(lines.join("\n"));
