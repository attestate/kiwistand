// @format
// Limits for /api/v1/image-upload-token, which hands out one-time Cloudflare
// Images upload URLs (posts, image stories, avatars on web and iOS).
//
// Two ways to ask for one:
//
// - GET: anonymous, what every client did so far (web before this change,
//   all shipped iOS builds, avatar uploads during onboarding before the
//   account exists). Limited per IP. IMAGE_UPLOAD_REQUIRE_AUTH=true turns
//   it off once the apps sign their requests.
// - POST with a signed Kiwi message { type: "imageupload", title: "",
//   href: "", timestamp, signature } (EIP-712, like bookmarks): the signer
//   must resolve to an account through the delegations. Limited per account
//   (and per IP).
//
// The upload URL itself expires after UPLOAD_EXPIRY_SECONDS and Cloudflare
// caps a picture at 10 MB; the image's metadata records who asked for it,
// so moderation can find someone's uploads.
//
// NOTE: The token route runs on the primary process only (load-balancer.mjs
// doesn't send it to the workers), so in-memory counters cover all requests.
import { env } from "process";
import { createHash } from "crypto";

export const UPLOAD_EXPIRY_SECONDS = 10 * 60;
// Cloudflare Images' own limit for a picture.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function requireAuth() {
  return env.IMAGE_UPLOAD_REQUIRE_AUTH === "true";
}

// Sliding window: at most `limit` hits per key within `windowMs`.
export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  take(key, now = Date.now()) {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) || []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const retryAfter = Math.ceil((recent[0] + this.windowMs - now) / 1000);
      return { ok: false, retryAfter: Math.max(retryAfter, 1) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10000) this.prune(now);
    return { ok: true, retryAfter: 0 };
  }

  prune(now = Date.now()) {
    const since = now - this.windowMs;
    for (const [key, times] of this.hits) {
      if (!times.some((t) => t > since)) this.hits.delete(key);
    }
  }
}

export const limiters = {
  // Anonymous (GET) requests per IP.
  anonymous: new RateLimiter({
    limit: number(env.IMAGE_UPLOAD_ANON_PER_HOUR, 10),
    windowMs: HOUR,
  }),
  // Signed requests per account.
  identity: new RateLimiter({
    limit: number(env.IMAGE_UPLOAD_PER_DAY, 30),
    windowMs: DAY,
  }),
  // Every request per IP, signed or not.
  ip: new RateLimiter({
    limit: number(env.IMAGE_UPLOAD_IP_PER_HOUR, 30),
    windowMs: HOUR,
  }),
};

// The visitor's IP: Cloudflare's header in production, then the proxy's.
export function clientIP(request) {
  const headers = (request && request.headers) || {};
  const forwarded = String(headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return (
    headers["cf-connecting-ip"] ||
    forwarded ||
    (request && request.ip) ||
    (request && request.socket && request.socket.remoteAddress) ||
    "unknown"
  );
}

// { ok: true } or { ok: false, retryAfter } (seconds).
export function check({ ip, identity }, now = Date.now()) {
  const perIP = limiters.ip.take(ip, now);
  if (!perIP.ok) return perIP;
  if (identity) return limiters.identity.take(identity.toLowerCase(), now);
  return limiters.anonymous.take(ip, now);
}

const hashIP = (ip) =>
  createHash("sha256").update(String(ip)).digest("hex").slice(0, 16);

// The body for Cloudflare's direct_upload (v2): a short expiry and who asked
// (account or a hash of the IP, never the IP itself).
export function directUploadParams(
  { accountId, identity, ip, client },
  now = Date.now(),
) {
  const expiry = new Date(now + UPLOAD_EXPIRY_SECONDS * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const metadata = { source: "kiwinews" };
  if (identity) metadata.identity = identity.toLowerCase();
  else metadata.ipHash = hashIP(ip);
  if (client) metadata.client = String(client).slice(0, 32);
  return {
    account_id: accountId,
    expiry,
    // NOTE: The API takes metadata as a JSON string form field.
    metadata: JSON.stringify(metadata),
  };
}
