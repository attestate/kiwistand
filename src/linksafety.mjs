// @format
//
// Link safety: hides stories whose link is known to be malicious (phishing,
// wallet drainers, malware).
//
// - Links on big, reputable domains (x.com, github.com, ...) are never checked.
// - Every other http(s) link is checked against ChainPatrol's asset check API
//   (which also aggregates MetaMask's eth-phishing-detect list) and, if
//   GOOGLE_SAFE_BROWSING_KEY is set, Google Safe Browsing.
// - Verdicts are stored in the SQLite ltCache table (shared by all cluster
//   workers) with a TTL, so rendering only ever does a synchronous lookup.
//   Unknown or stale links are checked in the background and never block a
//   request.
//
// Env:
// - CHAINPATROL_API_KEY (optional): sent as X-API-KEY. The asset check
//   endpoint currently answers without a key; a key raises rate limits.
// - GOOGLE_SAFE_BROWSING_KEY (optional): enables Google Safe Browsing.
// - LINK_SAFETY_DISABLED=true: turns off all checks and filtering.
import { env } from "process";

import normalizeUrl from "normalize-url";

import log from "./logger.mjs";
import { lifetimeCache } from "./cache.mjs";

export const CHAINPATROL_URL = "https://app.chainpatrol.io/api/v2/asset/check";
export const SAFE_BROWSING_URL =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
export const TTL = {
  blocked: 30 * day,
  safe: day,
  unknown: day,
  // A failed lookup is remembered briefly so an outage doesn't make us
  // re-request the same link on every page render.
  error: 10 * 60 * 1000,
};

const REQUEST_TIMEOUT_MS = 5000;
const MAX_CONCURRENCY = 4;
const MAX_QUEUE = 1000;
const KEY_PREFIX = "linksafety:";

// NOTE: Registrable domains whose links we don't check. A link matches when
// its host is the domain itself or one of its subdomains, so "evil-x.com" or
// "x.com.evil.io" never match "x.com". Don't add hosting platforms where
// anyone can publish a site on a subdomain (github.io, vercel.app, pages.dev,
// netlify.app, notion.site, sites.google.com, ...): phishing kits live there.
export const SAFE_DOMAINS = new Set([
  // Kiwi
  "kiwistand.com",
  "imagedelivery.net",
  // Social
  "x.com",
  "twitter.com",
  "t.co",
  "warpcast.com",
  "farcaster.xyz",
  "reddit.com",
  "linkedin.com",
  "bsky.app",
  "threads.net",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "news.ycombinator.com",
  "lobste.rs",
  "producthunt.com",
  // Video / audio
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "twitch.tv",
  "spotify.com",
  "podcasts.apple.com",
  // Code / research
  "github.com",
  "gitlab.com",
  "githubusercontent.com",
  "npmjs.com",
  "arxiv.org",
  "eprint.iacr.org",
  "wikipedia.org",
  "stackoverflow.com",
  "huggingface.co",
  // Writing platforms
  "substack.com",
  "medium.com",
  "mirror.xyz",
  "paragraph.xyz",
  "paragraph.com",
  "hackmd.io",
  // Ethereum ecosystem
  "ethereum.org",
  "ethresear.ch",
  "ethereum-magicians.org",
  "eips.ethereum.org",
  "vitalik.eth.limo",
  "etherscan.io",
  "optimism.io",
  "base.org",
  "coinbase.com",
  "a16zcrypto.com",
  "paradigm.xyz",
  "theblock.co",
  "coindesk.com",
  "decrypt.co",
  "blockworks.co",
  "bankless.com",
  "messari.io",
  "defillama.com",
  "dune.com",
  // News
  "nytimes.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "reuters.com",
  "apnews.com",
  "bbc.co.uk",
  "bbc.com",
  "theguardian.com",
  "economist.com",
  "theverge.com",
  "wired.com",
  "techcrunch.com",
  "arstechnica.com",
  "theatlantic.com",
  "newyorker.com",
  "washingtonpost.com",
  "cnbc.com",
  "axios.com",
  "fortune.com",
  "forbes.com",
  "nature.com",
  "science.org",
  // Big tech
  "apple.com",
  "microsoft.com",
  "openai.com",
  "anthropic.com",
  "blog.google",
]);

function hostOf(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return hostname.toLowerCase().replace(/\.$/, "");
  } catch (err) {
    return null;
  }
}

export function isKnownSafe(url) {
  const host = hostOf(url);
  if (!host) return false;
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (SAFE_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return false;
}

// Text posts, kiwi: references and non-http links aren't checked.
function isCheckable(url) {
  return typeof url === "string" && hostOf(url) !== null && !isKnownSafe(url);
}

function enabled() {
  return env.LINK_SAFETY_DISABLED !== "true";
}

function keyFor(url) {
  let normalized = url;
  try {
    normalized = normalizeUrl(url, { stripWWW: false });
  } catch (err) {}
  return KEY_PREFIX + normalized;
}

// Synchronous lookup of the stored verdict, including stale ones.
export function getVerdict(url) {
  try {
    const record = lifetimeCache.get(keyFor(url));
    if (!record || !record.status) return null;
    const ttl = TTL[record.error ? "error" : record.status] ?? TTL.unknown;
    return { ...record, fresh: Date.now() - record.checkedAt < ttl };
  } catch (err) {
    log(`linksafety: cache read failed for "${url}": ${err.toString()}`);
    return null;
  }
}

function storeVerdict(url, record) {
  try {
    lifetimeCache.set(keyFor(url), { ...record, url, checkedAt: Date.now() });
  } catch (err) {
    log(`linksafety: cache write failed for "${url}": ${err.toString()}`);
  }
}

async function postJSON(fetchFn, url, headers, body) {
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return await response.json();
}

export async function queryChainPatrol(url, fetchFn = globalThis.fetch) {
  const headers = env.CHAINPATROL_API_KEY
    ? { "X-API-KEY": env.CHAINPATROL_API_KEY }
    : {};
  const data = await postJSON(fetchFn, CHAINPATROL_URL, headers, {
    type: "URL",
    content: url,
  });
  const status =
    data.status === "BLOCKED"
      ? "blocked"
      : data.status === "ALLOWED"
        ? "safe"
        : "unknown";
  const blockers = (data.sources || [])
    .filter((s) => s.status === "BLOCKED")
    .map((s) => s.source);
  const reason =
    status === "blocked"
      ? `chainpatrol: BLOCKED by ${blockers.join(", ") || data.source}`
      : `chainpatrol: ${data.status}`;
  return { status, source: "chainpatrol", reason };
}

export async function querySafeBrowsing(url, fetchFn = globalThis.fetch) {
  const data = await postJSON(
    fetchFn,
    `${SAFE_BROWSING_URL}?key=${encodeURIComponent(env.GOOGLE_SAFE_BROWSING_KEY)}`,
    {},
    {
      client: { clientId: "kiwinews", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    },
  );
  const matches = data.matches || [];
  if (matches.length > 0) {
    const types = [...new Set(matches.map((m) => m.threatType))].join(", ");
    return {
      status: "blocked",
      source: "google-safe-browsing",
      reason: `google-safe-browsing: ${types}`,
    };
  }
  return { status: "unknown", source: "google-safe-browsing", reason: "" };
}

const inflight = new Map();

// Checks a link against the providers (or the cache when fresh) and returns
// "safe" | "blocked" | "unknown". Never throws.
export async function checkLink(url, { fetchFn = globalThis.fetch } = {}) {
  if (!enabled() || typeof url !== "string") return "unknown";
  if (isKnownSafe(url)) return "safe";
  if (!isCheckable(url)) return "unknown";

  const cached = getVerdict(url);
  if (cached && cached.fresh) return cached.status;

  const key = keyFor(url);
  if (inflight.has(key)) return await inflight.get(key);

  const promise = (async () => {
    const providers = [queryChainPatrol(url, fetchFn)];
    if (env.GOOGLE_SAFE_BROWSING_KEY) {
      providers.push(querySafeBrowsing(url, fetchFn));
    }
    const results = await Promise.allSettled(providers);
    const ok = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    results
      .filter((r) => r.status === "rejected")
      .forEach((r) =>
        log(`linksafety: lookup failed for "${url}": ${r.reason}`),
      );

    const blocked = ok.find((r) => r.status === "blocked");
    if (blocked) {
      log(`linksafety: BLOCKED "${url}" (${blocked.reason})`);
      storeVerdict(url, { status: "blocked", reason: blocked.reason });
      return "blocked";
    }
    if (ok.length === 0) {
      // Keep a previous verdict (e.g. a stale "blocked") during an outage.
      const status = cached?.status || "unknown";
      storeVerdict(url, {
        status,
        reason: cached?.reason || "",
        error: true,
      });
      return status;
    }
    const status = ok.some((r) => r.status === "safe") ? "safe" : "unknown";
    storeVerdict(url, {
      status,
      reason: ok.map((r) => r.reason).filter(Boolean).join("; "),
    });
    return status;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return await promise;
}

// Background queue so rendering a feed with many unchecked links doesn't
// fire hundreds of requests at once.
const queue = [];
const queued = new Set();
let running = 0;

function drain() {
  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const url = queue.shift();
    running++;
    checkLink(url)
      .catch((err) => log(`linksafety: check failed: ${err.toString()}`))
      .finally(() => {
        running--;
        queued.delete(keyFor(url));
        drain();
      });
  }
}

// Schedules a background check for the link if it has no fresh verdict.
export function warmLink(url) {
  if (!enabled() || !isCheckable(url)) return;
  const cached = getVerdict(url);
  if (cached && cached.fresh) return;
  const key = keyFor(url);
  if (queued.has(key) || inflight.has(key)) return;
  if (queue.length >= MAX_QUEUE) return;
  queued.add(key);
  queue.push(url);
  drain();
}

// Synchronous: true only when a link has a stored "blocked" verdict. Links
// without a fresh verdict are checked in the background, so they get hidden
// shortly after if they turn out to be malicious.
export function isBlocked(url) {
  if (!enabled() || !isCheckable(url)) return false;
  const cached = getVerdict(url);
  if (!cached || !cached.fresh) warmLink(url);
  return cached?.status === "blocked";
}

// For moderators: every link that is currently hidden and why.
export function listBlocked() {
  return lifetimeCache
    .keys(KEY_PREFIX)
    .map((key) => lifetimeCache.get(key))
    .filter((record) => record && record.status === "blocked")
    .map(({ url, reason, checkedAt }) => ({ url, reason, checkedAt }));
}

// Test helper
export function _resetForTests() {
  inflight.clear();
  queue.length = 0;
  queued.clear();
  running = 0;
}
