// @format
//
// Hides stories whose link ChainPatrol flags as malicious (phishing, wallet
// drainers). Links on well-known domains are never checked. Other links are
// checked in the background and the verdict is cached, so rendering never
// waits on the network. LINK_SAFETY_DISABLED=true turns it off (tests).
import { env } from "process";

import log from "./logger.mjs";
import { lifetimeCache } from "./cache.mjs";

const SAFE_DOMAINS = [
  "x.com", "twitter.com", "github.com", "youtube.com", "youtu.be",
  "farcaster.xyz", "warpcast.com", "bsky.app", "reddit.com", "linkedin.com",
  "substack.com", "medium.com", "mirror.xyz", "paragraph.com", "paragraph.xyz",
  "ethereum.org", "wikipedia.org", "arxiv.org", "ycombinator.com",
  "nytimes.com", "theverge.com", "techcrunch.com", "bloomberg.com",
  "reuters.com", "coindesk.com", "theblock.co", "decrypt.co", "apple.com",
  "google.com",
];
const DAY = 24 * 60 * 60 * 1000;
const checking = new Set();

export function isKnownSafe(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  // Text posts (data:, kiwi:) have no link to check.
  if (!["http:", "https:"].includes(parsed.protocol)) return true;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return SAFE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isBlocked(url) {
  if (env.LINK_SAFETY_DISABLED === "true" || !url || isKnownSafe(url)) {
    return false;
  }
  const verdict = lifetimeCache.get(`linksafety:${url}`);
  const maxAge = (verdict?.blocked ? 30 : 1) * DAY;
  if (!verdict || Date.now() - verdict.checkedAt > maxAge) check(url);
  return !!verdict?.blocked;
}

async function check(url) {
  if (checking.has(url)) return;
  checking.add(url);
  try {
    const response = await fetch(
      "https://app.chainpatrol.io/api/v2/asset/check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "URL", content: url }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { status } = await response.json();
    const blocked = status === "BLOCKED";
    lifetimeCache.set(`linksafety:${url}`, { blocked, checkedAt: Date.now() });
    if (blocked) log(`linksafety: hiding stories linking to ${url}`);
  } catch (err) {
    log(`linksafety: check failed for ${url}: ${err.message}`);
  } finally {
    checking.delete(url);
  }
}
