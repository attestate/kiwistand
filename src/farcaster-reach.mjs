// @format
//
// More Farcaster distribution from the Kiwi account, on top of the daily top
// story in src/social-posting.mjs. Both features are off unless their flag
// is "true", and both cast straight to a hub (FC_FID, FC_SIGNER_PRIVATE_KEY,
// FC_HUB_URL), never via Neynar's paid API:
//
// - Author pings (FC_AUTHOR_PINGS=true): every FC_AUTHOR_PING_MINUTES (15)
//   the hot feed is checked. A story that enters its top 3 gets one cast,
//   "<title> is #N on Kiwi News today 🥝" with the story page as embed, and
//   tags the linked article's author when we're sure who that is (see
//   identifyAuthor). At most FC_AUTHOR_PINGS_PER_DAY (3) per UTC day. The
//   first check after enabling only records the current top 3, so turning
//   it on doesn't ping stories that have been there for hours. When the
//   author is tagged and on this month's /writers leaderboard, their row is
//   a second embed. Each check also records the best rank of every top 3
//   story ("peak"), which the "Featured on Kiwi News" badge and story pages
//   read (src/featured.mjs).
// - Rising casts (FC_RISING_CASTS=true): at FC_RISING_HOURS_UTC (10,20), the
//   best ranked hot story of the last 24h that we never cast, with its title,
//   the first sentence of its AI summary and the story page as embed, posted
//   into a Farcaster channel picked from its title (channelFor).
//
// Every story is cast at most once by any of these: pings, rising casts and
// the daily top story (social-posts.json) all count. The state is a small
// JSON file next to the social one (FC_REACH_STATE_FILE, default
// cache/farcaster-reach.json). Failures are logged and never thrown.
import { env } from "process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import path from "path";

import {
  FC_MAX_BYTES,
  storyUrl,
  hookOf,
  truncate,
  capitalize,
  sendCastViaHub,
  withSummary,
  loadState as loadSocialState,
  defaultStatePath as defaultSocialStatePath,
  wasPosted,
  minUpvotes,
  dueSlot,
} from "./social-posting.mjs";
import { statePath as featuredStatePath } from "./featured.mjs";

const HUB_ENV = ["FC_FID", "FC_SIGNER_PRIVATE_KEY", "FC_HUB_URL"];
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 60;

// --- Flags --------------------------------------------------------------

export function authorPingsEnabled(vars = env) {
  return vars.FC_AUTHOR_PINGS === "true";
}

export function risingCastsEnabled(vars = env) {
  return vars.FC_RISING_CASTS === "true";
}

export function hubMissing(vars = env) {
  return HUB_ENV.filter((name) => !vars[name]);
}

function intOr(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function pingsPerDay(vars = env) {
  return intOr(vars.FC_AUTHOR_PINGS_PER_DAY, 3);
}

export function pingIntervalMinutes(vars = env) {
  return Math.max(1, intOr(vars.FC_AUTHOR_PING_MINUTES, 15));
}

export function risingHours(vars = env) {
  return (vars.FC_RISING_HOURS_UTC ?? "10,20")
    .split(",")
    .map((h) => parseInt(h.trim(), 10))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
}

// --- Channels -----------------------------------------------------------

// NOTE: A cast lands in a channel through its parentUrl, which must be the
// URL the channel was registered with, not a URL built from its id. Older
// channels use a website or a chain:// NFT URL, newer ones
// https://warpcast.com/~/channel/<id>. These come from the public
// https://api.farcaster.xyz/v1/channel?channelId=<id> ("url" field).
// The first channel whose keywords match the title (and summary sentence)
// wins, so more specific channels come first.
export const CHANNEL_MAP = [
  {
    id: "farcaster",
    parentUrl:
      "chain://eip155:7777777/erc721:0x4f86113fc3e9783cf3ec9a552cbb566716a57628",
    pattern: /\b(farcaster|warpcast|snapchain|mini ?apps?|frames v2)\b/i,
  },
  {
    id: "base",
    parentUrl: "https://onchainsummer.xyz",
    pattern:
      /\b(base (chain|network|app|l2|mainnet|sepolia|names?)|on base|base\.org|jesse pollak)\b/i,
  },
  {
    id: "ai",
    parentUrl:
      "chain://eip155:7777777/erc721:0x5747eef366fd36684e8893bf4fe628efc2ac2d10",
    pattern:
      /\b(ai|llms?|chatgpt|gpt-?\d[\w.]*|openai|anthropic|claude|gemini|machine learning|neural networks?|ai agents?|agentic)\b/i,
  },
  {
    id: "defi",
    parentUrl: "https://farcaster.group/defi",
    pattern:
      /\b(defi|uniswap|aave|morpho|lido|curve|makerdao|stablecoins?|dexs?|amms?|lending|liquidity|yields?|restaking)\b/i,
  },
  {
    id: "ethereum",
    parentUrl: "https://ethereum.org",
    pattern:
      /\b(ethereum|eth|evm|eips?|eip-\d+|erc-?\d+|rollups?|l2s?|vitalik|solidity|validators?|pectra|fusaka|glamsterdam)\b/i,
  },
  {
    id: "dev",
    parentUrl: "chain://eip155:1/erc721:0x7dd4e31f1530ac682c8ea4d8016e95773e08d8b0",
    pattern:
      /\b(developers?|programming|typescript|javascript|rust|golang|python|compilers?|open[- ]source|github|sdks?|devtools?|coding)\b/i,
  },
];

// Returns { id, parentUrl } or null (cast without a channel).
export function channelFor(...texts) {
  const text = texts.filter(Boolean).join("\n");
  if (!text) return null;
  const match = CHANNEL_MAP.find(({ pattern }) => pattern.test(text));
  return match ? { id: match.id, parentUrl: match.parentUrl } : null;
}

// --- Cast text ----------------------------------------------------------

const bytes = (text) => Buffer.byteLength(text, "utf8");
const fits = (text) => bytes(text) <= FC_MAX_BYTES;

export const PING_SUFFIX = (rank) => ` is #${rank} on Kiwi News today 🥝`;
const BY = "\n\nby ";

// "<title> is #N on Kiwi News today 🥝", plus "by @author" when we know the
// author. A Farcaster mention isn't text: the @name is left out and the fid
// goes in mentions, at the UTF-8 byte offset in mentionsPositions where
// clients render it.
// entryUrl, e.g. the writer's row on /writers, is a second embed.
export function buildPingCast({ title, rank, url, authorFid, entryUrl }) {
  const suffix = PING_SUFFIX(rank);
  const tail = authorFid ? BY : "";
  const head = truncate(capitalize(String(title || "").trim()), (t) =>
    fits(`${t}${suffix}${tail}`),
  );
  const text = `${head}${suffix}${tail}`;
  const embeds = entryUrl && entryUrl !== url ? [url, entryUrl] : [url];
  const cast = { text, embeds, mentions: [], mentionsPositions: [] };
  if (authorFid) {
    cast.mentions = [authorFid];
    cast.mentionsPositions = [bytes(text)];
  }
  return cast;
}

// Title and the summary's first sentence; drops the sentence before
// shortening the title.
export function buildRisingCast({ title, summary, url, channel }) {
  const clean = capitalize(String(title || "").trim());
  const hook = hookOf(summary);
  let text;
  if (hook && fits(`${clean}\n\n${hook}`)) {
    text = `${clean}\n\n${hook}`;
  } else {
    text = truncate(clean, fits);
  }
  const cast = { text, embeds: [url], mentions: [], mentionsPositions: [] };
  if (channel?.parentUrl) cast.parentUrl = channel.parentUrl;
  return cast;
}

// --- Hub reads ----------------------------------------------------------

// Read-only lookups against the hub's HTTP API. Every function returns null
// (or []) when the hub doesn't know or doesn't answer.
export function hubReader({ fetch = globalThis.fetch, vars = env } = {}) {
  const hub = String(vars.FC_HUB_URL || "").replace(/\/+$/, "");
  const get = async (route) => {
    if (!hub) return null;
    try {
      const response = await fetch(`${hub}${route}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  };
  return {
    // The fid that currently holds an fname or a .eth name, with the
    // address that owns the name.
    async nameProof(name) {
      const proof = await get(
        `/v1/userNameProofByName?name=${encodeURIComponent(name)}`,
      );
      if (!proof?.fid) return null;
      return {
        fid: Number(proof.fid),
        owner: String(proof.owner || "").toLowerCase(),
        type: proof.type,
      };
    },
    // Ethereum addresses the fid verified (signed) on the protocol.
    async verifiedAddresses(fid) {
      const data = await get(`/v1/verificationsByFid?fid=${fid}&pageSize=100`);
      return (data?.messages || [])
        .map((m) => m?.data?.verificationAddAddressBody)
        .filter((body) => body && body.protocol !== "PROTOCOL_SOLANA")
        .map((body) => String(body.address || "").toLowerCase())
        .filter(Boolean);
    },
    // The X username the fid put in its profile, if any.
    async twitterOf(fid) {
      const data = await get(`/v1/userDataByFid?fid=${fid}`);
      const message = (data?.messages || []).find(
        (m) => m?.data?.userDataBody?.type === "USER_DATA_TYPE_TWITTER",
      );
      return message?.data?.userDataBody?.value || null;
    },
    // The fid whose custody address this is right now.
    async custodyFid(address) {
      const event = await get(
        `/v1/onChainIdRegistryEventByAddress?address=${address}`,
      );
      if (!event?.fid) return null;
      const events = await get(
        `/v1/onChainEventsByFid?fid=${event.fid}&event_type=EVENT_TYPE_ID_REGISTER`,
      );
      const transfers = (events?.events || [])
        .filter((e) => e?.idRegisterEventBody?.to)
        .sort((a, b) => (a.blockNumber || 0) - (b.blockNumber || 0));
      const latest = transfers[transfers.length - 1];
      return latest &&
        String(latest.idRegisterEventBody.to).toLowerCase() === address
        ? Number(event.fid)
        : null;
    },
  };
}

// --- Author identification ----------------------------------------------

const FNAME = /^[a-z0-9][a-z0-9-]{0,15}$/;
const ENS_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
// NOTE: First path segments on farcaster.xyz / warpcast.com that are pages,
// not usernames.
const FARCASTER_PAGES = new Set([
  "~",
  "i",
  "login",
  "explore",
  "inbox",
  "notifications",
  "settings",
  "search",
  "miniapps",
  "frames",
  "developers",
  "compose",
  "home",
  "trending",
  "channel",
  "channels",
  "bookmarks",
  "download",
  "privacy",
  "terms",
  "communities",
  "wallet",
]);
const X_PAGES = new Set(["i", "home", "search", "explore", "hashtag", "intent", "share"]);

function parse(href) {
  if (typeof href !== "string" || !/^https?:\/\//.test(href)) return null;
  try {
    const url = new URL(href);
    return {
      host: url.hostname.toLowerCase().replace(/^www\./, ""),
      parts: url.pathname.split("/").filter(Boolean),
    };
  } catch (err) {
    return null;
  }
}

export function isFarcasterLink(href) {
  const url = parse(href);
  return Boolean(
    url &&
      (url.host === "farcaster.xyz" ||
        url.host === "warpcast.com" ||
        (url.host === "firefly.social" && url.parts[1] === "farcaster")),
  );
}

// The username a farcaster.xyz / warpcast.com profile or cast link points
// at: /<name> or /<name>/0x<hash>.
export function farcasterNameFromUrl(href) {
  const url = parse(href);
  if (!url || (url.host !== "farcaster.xyz" && url.host !== "warpcast.com"))
    return null;
  const [first, second, ...rest] = url.parts;
  if (!first || rest.length > 0) return null;
  const name = decodeURIComponent(first).replace(/^@/, "").toLowerCase();
  if (FARCASTER_PAGES.has(name)) return null;
  if (!FNAME.test(name) && !ENS_NAME.test(name)) return null;
  if (second && !/^0x[0-9a-f]{6,40}$/i.test(second)) return null;
  return name;
}

// The handle of an X post or profile link.
export function xHandleFromUrl(href) {
  const url = parse(href);
  if (!url || !/^(x|twitter|mobile\.twitter)\.com$/.test(url.host)) return null;
  const handle = url.parts[0];
  if (!handle || !/^\w{1,15}$/.test(handle)) return null;
  if (X_PAGES.has(handle.toLowerCase())) return null;
  return handle;
}

// The address or ENS name in a mirror.xyz/<author>/<digest> link.
export function mirrorAuthorFromUrl(href) {
  const url = parse(href);
  if (!url || url.host !== "mirror.xyz") return null;
  const author = url.parts[0] ? decodeURIComponent(url.parts[0]) : "";
  if (ADDRESS.test(author)) return { address: author.toLowerCase() };
  if (ENS_NAME.test(author.toLowerCase())) return { name: author.toLowerCase() };
  return null;
}

// A handle from a page's twitter:creator ("@name"), as the metadata parser
// stores it.
export function handleFromCreator(creator) {
  const match = String(creator || "").trim().match(/^@?(\w{1,15})$/);
  return match ? match[1] : null;
}

// The fid an address belongs to, only when the protocol says so: the fid
// verified the address, owns its ENS name (ENS username proof), or holds it
// as custody address. Profile data (cached ENS/Neynar lookups) only
// suggests candidates.
export async function fidForAddress(address, reader, profile = {}) {
  if (!address || !ADDRESS.test(address)) return null;
  const addr = address.toLowerCase();
  const candidates = [
    profile?.farcaster?.fid,
    profile?.neynar?.farcaster?.fid,
  ].filter((fid) => Number.isInteger(Number(fid)) && Number(fid) > 0);
  for (const fid of new Set(candidates.map(Number))) {
    const verified = await reader.verifiedAddresses(fid);
    if (verified.includes(addr)) return fid;
  }
  const ens = String(profile?.ens || "").toLowerCase();
  if (ENS_NAME.test(ens)) {
    const proof = await reader.nameProof(ens);
    if (proof && proof.owner === addr) return proof.fid;
  }
  return await reader.custodyFid(addr);
}

// The fid of an X handle's owner: only when the same name is an fname whose
// holder lists that very X account in their Farcaster profile.
async function fidForXHandle(handle, reader) {
  const name = handle.toLowerCase();
  if (!FNAME.test(name)) return null;
  const proof = await reader.nameProof(name);
  if (!proof) return null;
  const twitter = await reader.twitterOf(proof.fid);
  if (!twitter || twitter.replace(/^@/, "").toLowerCase() !== name) return null;
  return proof.fid;
}

// Who wrote what a story links to, as { fid, source }, or null when we
// aren't sure. In order:
// 1. The link is a Farcaster cast or profile: its author.
// 2. The linked page names its author: a mirror.xyz address or ENS name, an
//    X post's handle, or the page's twitter:creator.
// 3. The submitter wrote it: a Kiwi text post, or a link on a domain the
//    submitter is a registered writer for (the feed's isOriginal).
// Never guesses: a name that merely looks the same isn't enough.
export async function identifyAuthor(story, reader, options = {}) {
  const { resolveProfile = async () => ({}) } = options;
  const href = String(story?.href || "");
  const metadata = story?.metadata || {};

  if (isFarcasterLink(href)) {
    const fromUrl = farcasterNameFromUrl(href);
    const fromMeta = metadata.farcasterCast?.author?.username
      ? String(metadata.farcasterCast.author.username).toLowerCase()
      : null;
    if (fromUrl && fromMeta && fromUrl !== fromMeta) return null;
    const name = fromUrl || fromMeta;
    if (!name || (!FNAME.test(name) && !ENS_NAME.test(name))) return null;
    const proof = await reader.nameProof(name);
    return proof ? { fid: proof.fid, source: "farcaster-link" } : null;
  }

  const mirror = mirrorAuthorFromUrl(href);
  if (mirror?.address) {
    const fid = await fidForAddress(
      mirror.address,
      reader,
      await resolveProfile(mirror.address),
    );
    if (fid) return { fid, source: "mirror-address" };
  } else if (mirror?.name) {
    const proof = await reader.nameProof(mirror.name);
    if (proof) return { fid: proof.fid, source: "mirror-ens" };
  }

  const xHandle = xHandleFromUrl(href);
  const creator = xHandle || handleFromCreator(metadata.twitterCreator);
  if (creator) {
    const fid = await fidForXHandle(creator, reader);
    if (fid) return { fid, source: xHandle ? "x-link" : "twitter-creator" };
  }

  const textPost = href.startsWith("data:");
  if ((textPost || story?.isOriginal === true) && story?.identity) {
    const fid = await fidForAddress(
      story.identity,
      reader,
      story.submitter || (await resolveProfile(story.identity)),
    );
    if (fid) return { fid, source: textPost ? "text-post" : "writer-domain" };
  }
  return null;
}

// --- State --------------------------------------------------------------

// NOTE: src/featured.mjs reads the "peak" record of the same file for the
// story page badges.
export function defaultStatePath(vars = env) {
  return featuredStatePath(vars);
}

export function loadState(file) {
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    return {
      initialized: Boolean(state.initialized),
      seenTop: state.seenTop || {},
      pings: state.pings || {},
      rising: state.rising || {},
      peak: state.peak || {},
      lastRisingSlot: state.lastRisingSlot || null,
    };
  } catch (err) {
    return {
      initialized: false,
      seenTop: {},
      pings: {},
      rising: {},
      peak: {},
      lastRisingSlot: null,
    };
  }
}

function prune(record, cutoff, at = (v) => v) {
  const kept = {};
  for (const [k, v] of Object.entries(record)) if (at(v) >= cutoff) kept[k] = v;
  return kept;
}

export function saveState(file, state, now = Date.now()) {
  const cutoff = now - KEEP_DAYS * DAY_MS;
  const out = {
    ...state,
    seenTop: prune(state.seenTop, cutoff),
    pings: prune(state.pings, cutoff, (v) => v.at),
    rising: prune(state.rising, cutoff, (v) => v.at),
    peak: prune(state.peak || {}, cutoff, (v) => v.at),
  };
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(out, null, 2));
  renameSync(tmp, file);
}

// Loads, changes and saves the state without awaiting in between, so the
// pings and the rising casts (separate timers) never overwrite each other.
export function updateState(file, change, now = Date.now()) {
  const state = loadState(file);
  change(state);
  saveState(file, state, now);
  return state;
}

// Remembers the best rank each story reached in the top 3, for badges.
export function recordPeaks(state, top, now) {
  state.peak = state.peak || {};
  top.forEach((story, i) => {
    const k = storyKey(story);
    const rank = Math.min(state.peak[k]?.rank || Infinity, i + 1);
    state.peak[k] = { rank, at: now };
  });
}

export function storyKey(story) {
  return String(story.index).toLowerCase().replace(/^0x/, "");
}

// Whether the Kiwi account already cast this story in any way.
export function alreadyCast(story, state, socialState) {
  const k = storyKey(story);
  return Boolean(
    state.pings[k] ||
      state.rising[k] ||
      (socialState && wasPosted(socialState, story, "farcaster")),
  );
}

function sameUTCDay(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

export function pingsOn(state, now) {
  return Object.values(state.pings).filter(({ at }) => sameUTCDay(at, now))
    .length;
}

// --- Runs ---------------------------------------------------------------

function deps(options) {
  const vars = options.vars || env;
  return {
    vars,
    now: options.now || (() => Date.now()),
    statePath: options.statePath || defaultStatePath(vars),
    socialStatePath: options.socialStatePath || defaultSocialStatePath(vars),
    reader: options.reader || hubReader({ fetch: options.fetch, vars }),
    send:
      options.send ||
      ((cast) =>
        sendCastViaHub(cast.text, cast.embeds, {
          fetch: options.fetch,
          vars,
          mentions: cast.mentions,
          mentionsPositions: cast.mentionsPositions,
          parentUrl: cast.parentUrl,
        })),
  };
}

const valid = (story) => story && story.index && story.title;

// Pings the stories that entered the hot feed's top 3 since the last check.
// Returns the casts sent, for tests and logs.
export async function runAuthorPings(options = {}) {
  const { vars, now, statePath, socialStatePath, reader, send } = deps(options);
  const sent = [];
  let stories;
  try {
    stories = await options.getHotStories();
  } catch (err) {
    console.error(`Farcaster author pings: could not load the hot feed: ${err.message}`);
    return sent;
  }
  const top = (stories || []).filter(valid).slice(0, 3);
  if (top.length === 0) return sent;

  const state = updateState(
    statePath,
    (latest) => recordPeaks(latest, top, now()),
    now(),
  );
  if (!state.initialized) {
    updateState(
      statePath,
      (latest) => {
        for (const story of top) latest.seenTop[storyKey(story)] = now();
        latest.initialized = true;
      },
      now(),
    );
    console.log(
      `Farcaster author pings: recorded the current top ${top.length} as already seen, pinging stories that enter it from now on`,
    );
    return sent;
  }

  const cap = pingsPerDay(vars);
  for (const [i, story] of top.entries()) {
    const k = storyKey(story);
    if (loadState(statePath).seenTop[k]) continue;
    // NOTE: Marked before casting, so a story is never pinged twice, also
    // not when the hub answers with an error after accepting the cast.
    const latest = updateState(
      statePath,
      (state) => {
        state.seenTop[k] = now();
      },
      now(),
    );
    if (alreadyCast(story, latest, loadSocialState(socialStatePath))) continue;
    if (pingsOn(latest, now()) >= cap) {
      console.log(
        `Farcaster author ping skipped for 0x${k}: daily cap of ${cap} reached`,
      );
      continue;
    }
    let author = null;
    try {
      author = await identifyAuthor(story, reader, options);
    } catch (err) {
      console.error(`Farcaster author ping: author lookup failed for 0x${k}: ${err.message}`);
    }
    const ownFid = parseInt(vars.FC_FID, 10);
    const authorFid = author && author.fid !== ownFid ? author.fid : null;
    const rank = i + 1;
    const url = storyUrl(story);
    // NOTE: The writer's leaderboard entry only when we tag the writer.
    let entryUrl = null;
    if (authorFid && options.writerEntryUrl) {
      try {
        entryUrl = await options.writerEntryUrl(story);
      } catch (err) {
        entryUrl = null;
      }
    }
    const cast = buildPingCast({
      title: story.title,
      rank,
      url,
      authorFid,
      entryUrl,
    });
    let result;
    try {
      result = await send(cast);
    } catch (err) {
      result = { success: false, error: err.message };
    }
    if (!result?.success) {
      console.error(
        `Farcaster author ping failed for 0x${k}: ${result?.error || "unknown error"}`,
      );
      continue;
    }
    updateState(
      statePath,
      (state) => {
        state.pings[k] = {
          at: now(),
          rank,
          ...(authorFid && { fid: authorFid, source: author.source }),
          ...(result.id && { hash: result.id }),
        };
      },
      now(),
    );
    console.log(
      `Farcaster author ping sent for 0x${k} (#${rank}${authorFid ? `, mentions fid ${authorFid} via ${author.source}` : ", no confident author"}): ${url}`,
    );
    sent.push({ story, cast, author: authorFid ? author : null });
  }
  return sent;
}

// The best ranked story of the last 24 hours that was never cast.
export async function pickRising(stories, state, socialState, options = {}) {
  const { now = Date.now(), min = 2, isAlive } = options;
  const since = (now - DAY_MS) / 1000;
  for (const story of stories || []) {
    if (!valid(story)) continue;
    if (!story.timestamp || story.timestamp < since) continue;
    if ((story.upvotes || 0) < min) continue;
    if (alreadyCast(story, state, socialState)) continue;
    if (isAlive && /^https?:/.test(story.href || "")) {
      let alive;
      try {
        alive = await isAlive(story.href);
      } catch (err) {
        // A failed liveness check shouldn't hold back the cast.
        alive = true;
      }
      if (!alive) continue;
    }
    return story;
  }
  return null;
}

export async function runRisingCast(options = {}) {
  const { vars, now, statePath, socialStatePath, send } = deps(options);
  let stories;
  try {
    stories = await (options.getStories || options.getHotStories)();
  } catch (err) {
    console.error(`Farcaster rising cast: could not load stories: ${err.message}`);
    return null;
  }
  const state = loadState(statePath);
  const story = await pickRising(stories, state, loadSocialState(socialStatePath), {
    now: now(),
    min: minUpvotes(vars),
    isAlive: options.isAlive,
  });
  if (!story) {
    console.log("Farcaster rising cast: no new story from the last 24h");
    return null;
  }
  const k = storyKey(story);
  // NOTE: getSummary (via withSummary) only returns summaries that pass
  // isSafeSummary.
  const { summary } = await (options.withSummary || withSummary)(story);
  const hook = hookOf(summary);
  const channel = channelFor(story.title, hook);
  const url = storyUrl(story);
  const cast = buildRisingCast({ title: story.title, summary, url, channel });
  let result;
  try {
    result = await send(cast);
  } catch (err) {
    result = { success: false, error: err.message };
  }
  if (!result?.success) {
    console.error(
      `Farcaster rising cast failed for 0x${k}: ${result?.error || "unknown error"}`,
    );
    return null;
  }
  updateState(
    statePath,
    (latest) => {
      latest.rising[k] = {
        at: now(),
        channel: channel?.id || null,
        ...(result.id && { hash: result.id }),
      };
    },
    now(),
  );
  console.log(
    `Farcaster rising cast sent for 0x${k} (${channel ? `channel /${channel.id}` : "no channel"}): ${url}`,
  );
  return { story, cast };
}

// --- Scheduler ----------------------------------------------------------

// Runs in the primary process. Returns the timers, or [] when both features
// are off.
export function startFarcasterReach(options = {}) {
  const vars = options.vars || env;
  const pings = authorPingsEnabled(vars);
  const rising = risingCastsEnabled(vars);
  if (!pings && !rising) {
    console.log(
      "Farcaster reach: author pings and rising casts off (FC_AUTHOR_PINGS, FC_RISING_CASTS)",
    );
    return [];
  }
  const missing = hubMissing(vars);
  if (missing.length) {
    console.log(`Farcaster reach: off (missing ${missing.join(", ")})`);
    return [];
  }
  const statePath = options.statePath || defaultStatePath(vars);
  const timers = [];
  const guard = (name, fn) => {
    let running = false;
    return async () => {
      if (running) return;
      running = true;
      try {
        await fn();
      } catch (err) {
        console.error(`Farcaster ${name} failed: ${err.stack || err}`);
      } finally {
        running = false;
      }
    };
  };

  if (pings) {
    const minutes = pingIntervalMinutes(vars);
    console.log(
      `Farcaster reach: author pings on, checking the top 3 every ${minutes} min, at most ${pingsPerDay(vars)} a day, state in ${statePath}`,
    );
    const tick = guard("author pings", () =>
      runAuthorPings({ ...options, vars, statePath }),
    );
    const timer = setInterval(tick, minutes * 60 * 1000);
    timer.unref?.();
    timers.push(timer);
    // NOTE: First check once the server is warm.
    const first = setTimeout(tick, options.firstDelayMs ?? 2 * 60 * 1000);
    first.unref?.();
    timers.push(first);
  }

  if (rising) {
    const hours = risingHours(vars);
    console.log(
      `Farcaster reach: rising casts on at ${hours.map((h) => `${h}:00`).join(", ")} UTC`,
    );
    const tick = guard("rising cast", async () => {
      const slot = dueSlot(new Date(), hours, loadState(statePath).lastRisingSlot);
      if (!slot) return;
      updateState(statePath, (state) => {
        state.lastRisingSlot = slot;
      });
      await runRisingCast({ ...options, vars, statePath });
    });
    const timer = setInterval(tick, options.intervalMs || 5 * 60 * 1000);
    timer.unref?.();
    timers.push(timer);
  }
  return timers;
}
