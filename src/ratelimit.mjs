//@format
// NOTE: In-memory, per-IP rate limits. The load balancer (load-balancer.mjs)
// is the one process that sees all site traffic, so its counts are exact;
// the node API on port 8443 (api.mjs) is a single process too. Counts reset
// when the process restarts, which is fine for abuse protection.
import net from "net";

// NOTE: Which address a request counts against.
//
// Production: Cloudflare -> nginx -> load balancer. The load balancer sees
// nginx's loopback address, so it trusts the client address that the proxy in
// front reports: CF-Connecting-IP (set by Cloudflare), else the first hop of
// X-Forwarded-For. Those headers are only trusted when the TCP peer is a proxy
// we run (loopback) or, with trustCloudflare, a Cloudflare edge address (the
// 8443 API is reached from Cloudflare directly). Anyone else connecting could
// put any value there, so for them the socket address counts.
//
// This relies on the origin only being reachable through Cloudflare: nginx
// passes client headers on, so a request sent to the origin IP directly could
// claim any CF-Connecting-IP. Restricting nginx to Cloudflare's ranges (or
// having it overwrite CF-Connecting-IP) closes that.

// https://www.cloudflare.com/ips-v4/ and /ips-v6/ (October 2026)
export const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const cloudflare = new net.BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [address, prefix] = range.split("/");
  cloudflare.addSubnet(address, Number(prefix), net.isIP(address) === 6 ? "ipv6" : "ipv4");
}

export function normalizeIp(address) {
  if (typeof address !== "string") return "";
  const ip = address.trim();
  // IPv4 clients on a dual-stack socket show up as ::ffff:1.2.3.4
  if (ip.toLowerCase().startsWith("::ffff:") && net.isIPv4(ip.slice(7))) {
    return ip.slice(7);
  }
  return ip;
}

export function isLoopback(address) {
  const ip = normalizeIp(address);
  return ip === "::1" || (net.isIPv4(ip) && ip.startsWith("127."));
}

export function isCloudflare(address) {
  const ip = normalizeIp(address);
  const family = net.isIP(ip);
  if (!family) return false;
  return cloudflare.check(ip, family === 6 ? "ipv6" : "ipv4");
}

function header(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function clientIp(req, { trustCloudflare = false } = {}) {
  const peer = normalizeIp(req.socket?.remoteAddress);
  const trusted =
    isLoopback(peer) || (trustCloudflare && isCloudflare(peer));
  if (!trusted) return peer;

  const cf = normalizeIp(header(req, "cf-connecting-ip"));
  if (net.isIP(cf)) return cf;

  const forwarded = header(req, "x-forwarded-for");
  if (typeof forwarded === "string") {
    const first = normalizeIp(forwarded.split(",")[0]);
    if (net.isIP(first)) return first;
  }
  return peer;
}

// NOTE: Fixed window counter per key. Keys sit in the Map in the order their
// window started, and all windows have the same length, so the expired ones
// are always at the front: each hit drops those, and past maxKeys the oldest
// key goes even if its window is still open. Memory stays bounded either way.
export function createLimiter({
  limit,
  windowMs,
  maxKeys = 100000,
  now = Date.now,
}) {
  const windows = new Map();

  function sweep(time) {
    for (const [key, entry] of windows) {
      if (time - entry.start < windowMs) break;
      windows.delete(key);
    }
    while (windows.size > maxKeys) {
      windows.delete(windows.keys().next().value);
    }
  }

  function hit(key) {
    const time = now();
    let entry = windows.get(key);
    if (!entry || time - entry.start >= windowMs) {
      // Delete before set so the key moves to the back of the Map.
      windows.delete(key);
      entry = { start: time, count: 0 };
      windows.set(key, entry);
    }
    entry.count += 1;
    sweep(time);

    const allowed = entry.count <= limit;
    const resetMs = entry.start + windowMs - time;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfter: Math.max(1, Math.ceil(resetMs / 1000)),
    };
  }

  return { hit, size: () => windows.size };
}

// Express matches routes case-insensitively and ignores a trailing slash, so
// /API/v1/cache/ reaches the same handler as /api/v1/cache.
export function normalizePath(path) {
  let p = String(path || "/");
  try {
    p = decodeURIComponent(p);
  } catch (err) {}
  p = p.toLowerCase().replace(/\/+$/, "");
  return p || "/";
}

const MINUTE = 60 * 1000;

// NOTE: Requests to the admin routes count whether or not the key was right.
// CORS preflights (OPTIONS) don't count elsewhere: browsers send one before a
// cross-origin POST, and http.mjs answers them without doing any work.
export const LOAD_BALANCER_RULES = [
  {
    name: "admin",
    limit: 10,
    windowMs: 15 * MINUTE,
    match: (req, path) =>
      path === "/api/v1/neynar/notify" ||
      path === "/api/v1/cache/profile" ||
      path === "/api/v1/cache",
  },
  {
    name: "parse",
    limit: 60,
    windowMs: MINUTE,
    match: (req, path) => req.method !== "OPTIONS" && path === "/api/v1/parse",
  },
  {
    name: "metadata",
    limit: 60,
    windowMs: MINUTE,
    match: (req, path) =>
      req.method !== "OPTIONS" && path === "/api/v1/metadata",
  },
  {
    // Reads the link's metadata and asks a model, like a title.
    name: "suggest",
    limit: 60,
    windowMs: MINUTE,
    match: (req, path) =>
      req.method !== "OPTIONS" && path === "/api/v1/communities/suggest",
  },
  {
    // Both ask the external search API: the JSON endpoint and the /search
    // page with a query (without one it's the empty search sheet).
    name: "search",
    limit: 60,
    windowMs: MINUTE,
    match: (req, path) =>
      (req.method !== "OPTIONS" && path === "/api/v1/search") ||
      (req.method === "GET" && path === "/search" && !!req.query?.q),
  },
];

export const API_RULES = [
  {
    name: "messages",
    limit: 30,
    windowMs: MINUTE,
    match: (req, path) => req.method === "POST" && path === "/api/v1/messages",
  },
];

// Express middleware. Requests from loopback that no proxy forwarded (e.g. a
// local health check or curl on the server) aren't limited.
export function rateLimit(
  rules,
  { now = Date.now, maxKeys, trustCloudflare = false } = {},
) {
  const limiters = rules.map((rule) => ({
    rule,
    limiter: createLimiter({
      limit: rule.limit,
      windowMs: rule.windowMs,
      maxKeys,
      now,
    }),
  }));

  const middleware = (req, res, next) => {
    const path = normalizePath(req.originalUrl?.split("?")[0] ?? req.path);
    const matched = limiters.filter(({ rule }) => rule.match(req, path));
    if (matched.length === 0) return next();

    const ip = clientIp(req, { trustCloudflare });
    if (isLoopback(ip)) return next();

    for (const { rule, limiter } of matched) {
      const result = limiter.hit(ip);
      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfter));
        res.setHeader("Cache-Control", "no-store");
        const details = `Rate limit of ${rule.limit} requests per ${
          rule.windowMs / 1000
        }s exceeded, retry in ${result.retryAfter}s`;
        return res.status(429).json({
          status: "error",
          code: 429,
          message: "Too Many Requests",
          details,
        });
      }
    }
    next();
  };
  middleware.limiters = limiters;
  return middleware;
}
