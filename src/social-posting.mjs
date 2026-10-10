// @format
//
// Posts Kiwi News stories to X (Twitter), Farcaster and the Telegram channel.
//
// Each channel is enabled only when all of its env vars are set:
// - X: CONSUMER_KEY, CONSUMER_SECRET, TWITTER_ACCESS_TOKEN,
//   TWITTER_ACCESS_TOKEN_SECRET (get the access token with
//   `node scripts/twitter-auth.mjs`). Posts via POST /2/tweets with OAuth 1.0a
//   user context.
// - Farcaster: NEYNAR_API_KEY, FC_SIGNER_UUID (an approved Neynar signer for
//   the Kiwi account, see `node scripts/create-farcaster-signer.mjs`). The
//   old FC_SEED_PHRASE path used Warpcast's private PUT /v2/auth, which now
//   answers 404 "Path /v2/auth does not exist".
// - Telegram: TG_KEY (bot token), optionally TG_CHANNEL_ID.
//
// Posting happens in two places:
// - startScheduler() runs in the primary process and posts the day's top
//   story once a day (SOCIAL_POST_HOURS_UTC).
// - POST /api/v1/neynar/notify (the manual push) posts the pushed story.
// Both go through postStory(), which records every successful post per
// channel in a small JSON file, so a story is never posted twice to the same
// channel.
//
// Failures never throw: they print one "social: <channel> post failed: ..."
// line to stderr with the HTTP status and a snippet of the response body.
import crypto from "crypto";
import { env } from "process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import path from "path";
import OAuth from "oauth-1.0a";

import { getSlug } from "./utils.mjs";

export const CHANNELS = ["x", "farcaster", "telegram"];

const LABELS = { x: "X", farcaster: "Farcaster", telegram: "Telegram" };

const REQUIRED_ENV = {
  x: [
    "CONSUMER_KEY",
    "CONSUMER_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_TOKEN_SECRET",
  ],
  farcaster: ["NEYNAR_API_KEY", "FC_SIGNER_UUID"],
  telegram: ["TG_KEY"],
};

// NOTE: The "Kiwi News" Telegram channel.
export const DEFAULT_TG_CHANNEL_ID = "-1001902081637";

export const X_ENDPOINT = "https://api.twitter.com/2/tweets";
export const NEYNAR_CAST_ENDPOINT = "https://api.neynar.com/v2/farcaster/cast";
const TELEGRAM_API = "https://api.telegram.org";

// NOTE: X counts every URL as 23 characters and allows 280 per post.
const X_MAX_CHARS = 280;
const X_URL_CHARS = 23;
// NOTE: Farcaster casts are limited to 320 bytes of text.
const FC_MAX_BYTES = 320;

export function missingEnv(channel, vars = env) {
  return REQUIRED_ENV[channel].filter((name) => !vars[name]);
}

export function enabledChannels(vars = env) {
  return CHANNELS.filter((channel) => missingEnv(channel, vars).length === 0);
}

// One line per channel, never with secret values, e.g.
// "social: X disabled (missing CONSUMER_KEY, TWITTER_ACCESS_TOKEN)".
export function statusLines(vars = env) {
  return CHANNELS.map((channel) => {
    const missing = missingEnv(channel, vars);
    return missing.length === 0
      ? `social: ${LABELS[channel]} enabled`
      : `social: ${LABELS[channel]} disabled (missing ${missing.join(", ")})`;
  });
}

export function snippet(text, max = 300) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

function failure(channel, status, body) {
  const error = status
    ? `HTTP ${status} ${snippet(body)}`.trim()
    : snippet(body) || "unknown error";
  console.error(`social: ${LABELS[channel]} post failed: ${error}`);
  return { success: false, status, error };
}

function notConfigured(channel, vars) {
  const missing = missingEnv(channel, vars);
  return {
    success: false,
    skipped: true,
    error: `${LABELS[channel]} not configured (missing ${missing.join(", ")})`,
  };
}

async function readBody(response) {
  try {
    return await response.text();
  } catch (err) {
    return "";
  }
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

// --- Formatting ---------------------------------------------------------

export function domainOf(href) {
  if (!href || href.startsWith("data:") || href.startsWith("kiwi:")) return "";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch (err) {
    return "";
  }
}

export function storyUrl({ title, index }) {
  const hex = String(index).replace(/^0x/, "");
  return `https://news.kiwistand.com/stories/${getSlug(title)}?index=0x${hex}`;
}

function truncate(text, fits) {
  if (fits(text)) return text;
  const chars = [...text];
  while (chars.length > 0 && !fits(`${chars.join("").trimEnd()}…`)) {
    chars.pop();
  }
  return `${chars.join("").trimEnd()}…`;
}

function headline(story) {
  const title = String(story.title || "").trim();
  const domain = domainOf(story.href);
  return domain ? `${title} - ${domain}` : title;
}

export function formatForX(story, url = storyUrl(story)) {
  // NOTE: Some characters (CJK, emoji) count double on X, so we leave room.
  const budget = X_MAX_CHARS - X_URL_CHARS - 2 - 10;
  const head = truncate(headline(story), (s) => [...s].length <= budget);
  return `${head}\n\n${url}`;
}

export function formatForFarcaster(story, url = storyUrl(story)) {
  const text = truncate(
    headline(story),
    (s) => Buffer.byteLength(s, "utf8") <= FC_MAX_BYTES,
  );
  return { text, embeds: [url] };
}

export function formatForTelegram(story, url = storyUrl(story)) {
  return `${headline(story)}\n\n${url}`;
}

// --- Senders --------------------------------------------------------------

export async function sendTweet(text, { fetch = globalThis.fetch, vars = env } = {}) {
  if (missingEnv("x", vars).length) return notConfigured("x", vars);
  const oauth = OAuth({
    consumer: { key: vars.CONSUMER_KEY, secret: vars.CONSUMER_SECRET },
    signature_method: "HMAC-SHA1",
    hash_function: (baseString, key) =>
      crypto.createHmac("sha1", key).update(baseString).digest("base64"),
  });
  const token = {
    key: vars.TWITTER_ACCESS_TOKEN,
    secret: vars.TWITTER_ACCESS_TOKEN_SECRET,
  };
  const { Authorization } = oauth.toHeader(
    oauth.authorize({ url: X_ENDPOINT, method: "POST" }, token),
  );
  try {
    const response = await fetch(X_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ text }),
    });
    const body = await readBody(response);
    if (!response.ok) return failure("x", response.status, body);
    const id = parseJSON(body)?.data?.id;
    console.log(`social: X posted ${id ? `tweet ${id}` : "a tweet"}`);
    return { success: true, status: response.status, id };
  } catch (err) {
    return failure("x", null, err.message);
  }
}

export async function sendCast(
  text,
  embeds = [],
  { fetch = globalThis.fetch, vars = env } = {},
) {
  if (missingEnv("farcaster", vars).length)
    return notConfigured("farcaster", vars);
  // NOTE: Neynar dedupes casts with the same idempotency key.
  const idem = crypto
    .createHash("sha256")
    .update(`${text}\n${embeds.join("\n")}`)
    .digest("hex")
    .slice(0, 16);
  try {
    const response = await fetch(NEYNAR_CAST_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": vars.NEYNAR_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        signer_uuid: vars.FC_SIGNER_UUID,
        text,
        embeds: embeds.map((url) => ({ url })),
        idem,
      }),
    });
    const body = await readBody(response);
    if (!response.ok) return failure("farcaster", response.status, body);
    const id = parseJSON(body)?.cast?.hash;
    console.log(`social: Farcaster posted ${id ? `cast ${id}` : "a cast"}`);
    return { success: true, status: response.status, id };
  } catch (err) {
    return failure("farcaster", null, err.message);
  }
}

export async function sendToTelegram(
  text,
  { fetch = globalThis.fetch, vars = env } = {},
) {
  if (missingEnv("telegram", vars).length)
    return notConfigured("telegram", vars);
  const chatId = vars.TG_CHANNEL_ID || DEFAULT_TG_CHANNEL_ID;
  try {
    // NOTE: The URL contains the bot token, so it must never be logged.
    const response = await fetch(
      `${TELEGRAM_API}/bot${vars.TG_KEY}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: false,
        }),
      },
    );
    const body = await readBody(response);
    const json = parseJSON(body);
    if (!response.ok || json?.ok === false)
      return failure("telegram", response.status, body);
    const id = json?.result?.message_id;
    console.log(`social: Telegram posted ${id ? `message ${id}` : "a message"}`);
    return { success: true, status: response.status, id };
  } catch (err) {
    return failure("telegram", null, err.message);
  }
}

export function preview(channel, story, url = storyUrl(story)) {
  if (channel === "x") return { text: formatForX(story, url) };
  if (channel === "farcaster") return formatForFarcaster(story, url);
  if (channel === "telegram") return { text: formatForTelegram(story, url) };
  throw new Error(`Unknown channel "${channel}"`);
}

export async function sendStory(channel, story, options = {}) {
  const url = options.url || storyUrl(story);
  const post = preview(channel, story, url);
  if (channel === "x") return sendTweet(post.text, options);
  if (channel === "farcaster") return sendCast(post.text, post.embeds, options);
  return sendToTelegram(post.text, options);
}

// --- Dedupe state -------------------------------------------------------

const KEEP_DAYS = 60;

export function defaultStatePath(vars = env) {
  return (
    vars.SOCIAL_STATE_FILE ||
    path.resolve(vars.CACHE_DIR || "cache", "social-posts.json")
  );
}

export function loadState(file) {
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    return { posted: state.posted || {}, lastSlot: state.lastSlot || null };
  } catch (err) {
    return { posted: {}, lastSlot: null };
  }
}

export function saveState(file, state, now = Date.now()) {
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const posted = {};
  for (const [index, channels] of Object.entries(state.posted)) {
    const times = Object.values(channels);
    if (times.length && Math.max(...times) >= cutoff) posted[index] = channels;
  }
  state.posted = posted;
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file);
}

function key(story) {
  return String(story.index).replace(/^0x/, "");
}

export function wasPosted(state, story, channel) {
  return Boolean(state.posted[key(story)]?.[channel]);
}

function markPosted(state, story, channel, now) {
  const k = key(story);
  state.posted[k] = { ...(state.posted[k] || {}), [channel]: now };
}

// Posts one story to the given channels, skipping disabled channels and
// channels the story was already posted to. Records successes in the state
// file right away.
export async function postStory(story, options = {}) {
  const {
    channels = CHANNELS,
    statePath = defaultStatePath(options.vars),
    now = () => Date.now(),
  } = options;
  const vars = options.vars || env;
  const results = {};
  for (const channel of channels) {
    if (missingEnv(channel, vars).length) {
      results[channel] = notConfigured(channel, vars);
      continue;
    }
    const state = loadState(statePath);
    if (wasPosted(state, story, channel)) {
      results[channel] = { success: false, skipped: true, error: "already posted" };
      continue;
    }
    const result = await sendStory(channel, story, { ...options, vars });
    results[channel] = result;
    if (result.success) {
      const latest = loadState(statePath);
      markPosted(latest, story, channel, now());
      saveState(statePath, latest, now());
    }
  }
  return results;
}

// --- Automatic posting --------------------------------------------------

export function minUpvotes(vars = env) {
  const value = parseInt(vars.SOCIAL_MIN_UPVOTES, 10);
  return Number.isNaN(value) ? 2 : value;
}

export function postHours(vars = env) {
  const raw = vars.SOCIAL_POST_HOURS_UTC ?? "16";
  return raw
    .split(",")
    .map((h) => parseInt(h.trim(), 10))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
}

export function autopostEnabled(vars = env) {
  if (vars.SOCIAL_AUTOPOST === "false") return false;
  if (vars.SOCIAL_AUTOPOST === "true") return true;
  return vars.NODE_ENV === "production";
}

// Returns the slot ("YYYY-MM-DDTHH") to run now, or null when it's not one
// of the posting hours or that slot already ran.
export function dueSlot(date, hours, lastSlot) {
  if (!hours.includes(date.getUTCHours())) return null;
  const slot = date.toISOString().slice(0, 13);
  return slot === lastSlot ? null : slot;
}

// Picks the highest ranked story that wasn't posted to the channel yet.
export async function pickStory(stories, channel, state, options = {}) {
  const { min = 2, isAlive } = options;
  for (const story of stories) {
    if (!story?.index || !story?.title) continue;
    if ((story.upvotes || 0) < min) continue;
    if (wasPosted(state, story, channel)) continue;
    if (isAlive && story.href && /^https?:/.test(story.href)) {
      let alive = true;
      try {
        alive = await isAlive(story.href);
      } catch (err) {
        alive = true;
      }
      if (!alive) continue;
    }
    return story;
  }
  return null;
}

// Posts the top unposted story of the day to each enabled channel.
export async function runOnce(options = {}) {
  const { getStories, isAlive } = options;
  const vars = options.vars || env;
  const statePath = options.statePath || defaultStatePath(vars);
  const channels = enabledChannels(vars);
  const results = {};
  if (channels.length === 0) return results;

  let stories;
  try {
    stories = await getStories();
  } catch (err) {
    console.error(`social: could not load stories: ${err.message}`);
    return results;
  }

  for (const channel of channels) {
    const state = loadState(statePath);
    const story = await pickStory(stories, channel, state, {
      min: minUpvotes(vars),
      isAlive,
    });
    if (!story) {
      console.log(`social: ${LABELS[channel]} has no new story to post`);
      continue;
    }
    const result = await postStory(story, {
      ...options,
      vars,
      statePath,
      channels: [channel],
    });
    results[channel] = { story, ...result[channel] };
  }
  return results;
}

// Runs in the primary process only. Checks every few minutes whether one of
// the posting hours started and, if so, runs runOnce() for that slot. The
// slot is persisted, so restarts don't post twice.
export function startScheduler(options = {}) {
  const vars = options.vars || env;
  for (const line of statusLines(vars)) console.log(line);
  if (!autopostEnabled(vars)) {
    console.log(
      "social: automatic posting off (needs NODE_ENV=production or SOCIAL_AUTOPOST=true)",
    );
    return null;
  }
  const hours = postHours(vars);
  if (enabledChannels(vars).length === 0 || hours.length === 0) {
    console.log("social: automatic posting off (no channel enabled or no hours)");
    return null;
  }
  const statePath = options.statePath || defaultStatePath(vars);
  console.log(
    `social: automatic posting at ${hours.map((h) => `${h}:00`).join(", ")} UTC, state in ${statePath}`,
  );

  let running = false;
  const tick = async () => {
    if (running) return;
    const state = loadState(statePath);
    const slot = dueSlot(new Date(), hours, state.lastSlot);
    if (!slot) return;
    running = true;
    try {
      state.lastSlot = slot;
      saveState(statePath, state);
      await runOnce({ ...options, vars, statePath });
    } catch (err) {
      console.error(`social: automatic posting failed: ${err.stack || err}`);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, options.intervalMs || 5 * 60 * 1000);
  timer.unref?.();
  return timer;
}
