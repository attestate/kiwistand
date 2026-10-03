#!/usr/bin/env node
// @format
//
// What search engines and AI crawlers get from news.kiwistand.com: fetches
// key pages and the sitemap with crawler and browser user agents and prints
// status, robots headers/meta, canonical and title per URL, so indexing
// blockers (403s for Googlebot, noindex, wrong canonicals, broken sitemaps)
// show up without Search Console. Runs in .github/workflows/metrics.yml.
//
// NOTE: The runner is a datacenter IP, so this shows what an unverified
// client gets. Cloudflare may treat the real crawlers (verified by IP) more
// leniently; Cloudflare's Security Events show what they actually got.
//
//   node scripts/crawl-check.mjs [--site https://news.kiwistand.com]
import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: { site: { type: "string", default: "https://news.kiwistand.com" } },
});

const agents = {
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  googlebot:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "Claude-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)",
  // Link previews when a Kiwi link is shared on X, Farcaster, Telegram, Slack.
  Twitterbot: "Twitterbot/1.0",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  TelegramBot: "TelegramBot (like TwitterBot)",
  Slackbot: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
};

const pick = (html, pattern) => html.match(pattern)?.[1]?.trim().slice(0, 100) ?? "–";

async function check(url, agent) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": agents[agent] },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const html = /html|xml/.test(response.headers.get("content-type") || "") ? await response.text() : "";
    return [
      agent,
      response.status,
      response.headers.get("location") || "",
      response.headers.get("x-robots-tag") || "",
      response.headers.get("cf-mitigated") || response.headers.get("cf-cache-status") || "",
      pick(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i),
      pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i),
      pick(html, /<title[^>]*>([^<]*)<\/title>/i).replace(/\|/g, "/"),
    ];
  } catch (err) {
    return [agent, `error: ${err.message}`, "", "", "", "", "", ""];
  }
}

const lines = ["# Crawl check", ""];

// Sitemaps: how many URLs, newest lastmod, and a sample story URL to check.
let sampleStory;
try {
  const index = await (await fetch(new URL("/sitemap.xml", args.site), { headers: { "User-Agent": agents.googlebot } })).text();
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  lines.push(`sitemap.xml: ${children.length} entries`, "");
  for (const child of children.slice(0, 5)) {
    if (!child.endsWith(".xml")) continue;
    const xml = await (await fetch(child, { headers: { "User-Agent": agents.googlebot } })).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]).sort();
    lines.push(`- ${child}: ${urls.length} URLs, newest lastmod ${lastmods.at(-1) || "–"}`);
    sampleStory ??= urls.find((url) => url.includes("/stories/"));
  }
  lines.push("");
} catch (err) {
  lines.push(`sitemap.xml: error ${err.message}`, "");
}

const pages = ["/", "/new", "/best", "/robots.txt", "/llms.txt", sampleStory].filter(Boolean);
for (const page of pages) {
  const url = new URL(page, args.site).href;
  lines.push(`## ${url}`, "", "| agent | status | location | x-robots-tag | cf | meta robots | canonical | title |", "|---|---|---|---|---|---|---|---|");
  for (const agent of Object.keys(agents)) {
    lines.push(`| ${(await check(url, agent)).join(" | ")} |`);
  }
  lines.push("");
}

console.log(lines.join("\n"));
