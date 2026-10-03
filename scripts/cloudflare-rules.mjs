#!/usr/bin/env node
// @format
//
// Shows a summary of the zone's Cloudflare bot setup and, with --apply, adds (or
// updates) one custom rule that lets machine-readable files skip Super Bot
// Fight Mode: the RSS feed, sitemaps, robots.txt, llms.txt and farcaster.json.
// Their clients (RSS readers, Farcaster) can't solve the managed challenge
// that "definitely automated" traffic gets, and Cloudflare's firewall events
// show RSS readers on cloud IPs being challenged on /feed.xml. HTML pages keep
// the challenge: there it mostly stops scrapers, and verified crawlers
// (Googlebot, Bingbot, ClaudeBot, Applebot) already pass. Everything else
// (WAF managed rules, rate limiting, the other custom rules) keeps running.
//
// Runs in .github/workflows/cloudflare-rules.yml.
//
// Environment:
//   CLOUDFLARE_WAF_TOKEN  API token: Zone → Zone WAF → Edit (and, optional,
//                         Zone → Bot Management → Read) for kiwistand.com
//   CLOUDFLARE_ZONE_ID    zone id of kiwistand.com
//
//   node scripts/cloudflare-rules.mjs            # dry run: print only
//   node scripts/cloudflare-rules.mjs --apply    # add or update the rule
import { env, argv, exit } from "process";

const apply = argv.includes("--apply");
const token = env.CLOUDFLARE_WAF_TOKEN;
const zone = env.CLOUDFLARE_ZONE_ID;
if (!token || !zone) {
  console.error("CLOUDFLARE_WAF_TOKEN and CLOUDFLARE_ZONE_ID must be set.");
  exit(1);
}

const REF = "kiwi_public_pages_skip_sbfm";
const rule = {
  ref: REF,
  description: "Feeds and machine-readable files: skip Super Bot Fight Mode",
  expression:
    '(http.request.method in {"GET" "HEAD"} and (http.request.uri.path in {"/feed.xml" "/robots.txt" "/llms.txt" "/.well-known/farcaster.json"} or (starts_with(http.request.uri.path, "/sitemap") and ends_with(http.request.uri.path, ".xml"))))',
  action: "skip",
  action_parameters: { phases: ["http_request_sbfm"] },
  logging: { enabled: true },
  enabled: true,
};

async function cf(method, path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok && data.success !== false, data };
}

const errors = (res) => (res.data.errors || []).map((e) => e.message).join("; ") || res.status;

// Bot settings, for the record (needs Bot Management: Read; optional).
const bots = await cf("GET", `/zones/${zone}/bot_management`);
console.log("## Bot settings\n");
if (bots.ok) {
  const s = bots.data.result || {};
  for (const key of [
    "fight_mode",
    "sbfm_definitely_automated",
    "sbfm_likely_automated",
    "sbfm_verified_bots",
    "sbfm_static_resource_protection",
    "ai_bots_protection",
    "enable_js",
  ]) {
    if (key in s) console.log(`- ${key}: ${s[key]}`);
  }
  if (s.fight_mode === true) {
    console.log(
      "\nNOTE: free Bot Fight Mode is on. It can't be skipped by rules, so the rule below won't help;",
      "turn Bot Fight Mode off or use Super Bot Fight Mode instead.",
    );
  }
} else {
  console.log(`(not readable: ${errors(bots)})`);
}

// Current custom rules.
const entry = await cf("GET", `/zones/${zone}/rulesets/phases/http_request_firewall_custom/entrypoint`);
if (!entry.ok && entry.status !== 404) {
  console.error(`\nCan't read custom rules: ${errors(entry)}`);
  exit(1);
}
const ruleset = entry.ok ? entry.data.result : null;
const rules = ruleset?.rules || [];
// NOTE: The repo is public, so are workflow logs: print only a summary of
// the other rules, not their expressions (blocked IPs, user agents).
const byAction = {};
for (const r of rules) byAction[r.action] = (byAction[r.action] || 0) + 1;
console.log(`\n## Custom rules: ${rules.length}`);
console.log(Object.entries(byAction).map(([action, n]) => `${action}: ${n}`).join(", ") || "none");

const existing = rules.find((r) => r.ref === REF);
console.log(`\n## Change\n`);
console.log(`${existing ? `Update (currently rule ${rules.indexOf(existing) + 1})` : "Add as first rule"}: ${rule.description}`);
console.log(`   skip → Super Bot Fight Mode only`);
console.log(`   ${rule.expression}`);

if (!apply) {
  console.log("\nDry run: nothing changed. Run with --apply (workflow input \"apply\") to make the change.");
  exit(0);
}

let result;
if (!ruleset) {
  result = await cf("PUT", `/zones/${zone}/rulesets/phases/http_request_firewall_custom/entrypoint`, {
    rules: [rule],
  });
} else if (existing) {
  result = await cf("PATCH", `/zones/${zone}/rulesets/${ruleset.id}/rules/${existing.id}`, rule);
} else {
  result = await cf("POST", `/zones/${zone}/rulesets/${ruleset.id}/rules`, {
    ...rule,
    position: rules.length ? { before: rules[0].id } : undefined,
  });
}
if (!result.ok) {
  console.error(`\nFailed: ${errors(result)}`);
  exit(1);
}
console.log("\nApplied.");
