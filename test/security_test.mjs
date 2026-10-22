//@format
import test from "ava";
import http from "http";
import express from "express";

import { createLoadBalancerApp } from "../src/load-balancer.mjs";
import {
  SECURITY_HEADERS,
  checkAdminKey,
  mergeFrameAncestors,
} from "../src/securityheaders.mjs";
import {
  clientIp,
  createLimiter,
  isCloudflare,
  normalizePath,
  rateLimit,
  API_RULES,
} from "../src/ratelimit.mjs";

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

// Stand-in for the primary and a worker (src/http.mjs): an HTML page, a JSON
// API with CORS, the AASA file and express's default 404.
function upstream(name) {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });
  app.get("/", (req, res) => res.type("html").send(`<p>${name}</p>`));
  app.get("/new", (req, res) => res.type("html").send(`<p>${name}</p>`));
  app.get("/api/v1/feeds/:name", (req, res) => res.json({ name }));
  app.get("/api/v1/parse", (req, res) => res.type("html").send("ok"));
  app.get("/api/v1/metadata", (req, res) => res.json({ ok: true }));
  app.post("/api/v1/search", (req, res) => res.json({ ok: true }));
  app.get("/search", (req, res) => res.type("html").send("search"));
  app.get("/api/v1/cache/profile", (req, res) => res.status(401).json({}));
  app.delete("/api/v1/cache", (req, res) => res.status(401).json({}));
  app.post("/api/v1/neynar/notify", (req, res) => res.status(401).json({}));
  app.get("/.well-known/apple-app-site-association", (req, res) =>
    res.json({ applinks: {} }),
  );
  return listen(app);
}

async function boot(t) {
  let time = 1_000_000;
  const clock = {
    now: () => time,
    advance: (ms) => (time += ms),
  };
  const primary = await upstream("primary");
  const worker = await upstream("worker");
  const app = createLoadBalancerApp({
    primaryPort: primary.address().port,
    workerBasePort: worker.address().port,
    workerCount: 1,
    now: clock.now,
  });
  const lb = await listen(app);
  t.teardown(() => {
    lb.close();
    primary.close();
    worker.close();
  });
  const port = lb.address().port;
  const request = (path, { method = "GET", ip, headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method,
          agent: false,
          headers: ip ? { "cf-connecting-ip": ip, ...headers } : headers,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, body }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  return { request, clock };
}

function assertSecurityHeaders(t, headers) {
  t.is(
    headers["strict-transport-security"],
    "max-age=31536000; includeSubDomains",
  );
  t.is(headers["x-content-type-options"], "nosniff");
  t.is(headers["referrer-policy"], "strict-origin-when-cross-origin");
  t.is(headers["permissions-policy"], SECURITY_HEADERS["Permissions-Policy"]);
  t.true(
    headers["content-security-policy"].endsWith(
      SECURITY_HEADERS["Content-Security-Policy"],
    ),
  );
  t.is(headers["x-frame-options"], undefined);
}

test("security headers on an HTML page, an API route, AASA and a 404", async (t) => {
  const { request } = await boot(t);
  for (const path of [
    "/",
    "/new",
    "/api/v1/feeds/hot",
    "/.well-known/apple-app-site-association",
    "/does-not-exist",
  ]) {
    const res = await request(path);
    assertSecurityHeaders(t, res.headers);
    // CORS from the upstream stays as it was.
    t.is(res.headers["access-control-allow-origin"], "*", path);
  }
  t.is(
    (await request("/")).headers["content-security-policy"],
    SECURITY_HEADERS["Content-Security-Policy"],
  );
  // express's default 404 keeps its own CSP and gets frame-ancestors added.
  const notFound = await request("/does-not-exist");
  t.is(notFound.status, 404);
  t.is(
    notFound.headers["content-security-policy"],
    `default-src 'none'; ${SECURITY_HEADERS["Content-Security-Policy"]}`,
  );
  t.is((await request("/api/v1/feeds/hot")).body, '{"name":"worker"}');
});

test("the load balancer's own proxy errors get the headers too", async (t) => {
  const app = createLoadBalancerApp({
    primaryPort: 1,
    workerBasePort: 1,
    workerCount: 1,
  });
  const lb = await listen(app);
  t.teardown(() => lb.close());
  const res = await new Promise((resolve) =>
    http.get(`http://127.0.0.1:${lb.address().port}/`, resolve),
  );
  res.resume();
  t.true(res.statusCode >= 500);
  t.is(res.headers["x-content-type-options"], "nosniff");
});

test("frame-ancestors allows the site and Farcaster clients only", (t) => {
  const csp = SECURITY_HEADERS["Content-Security-Policy"];
  t.true(csp.startsWith("frame-ancestors 'self' "));
  t.false(csp.includes(";"), "no other CSP directives");
  for (const origin of [
    "https://farcaster.xyz",
    "https://*.farcaster.xyz",
    "https://warpcast.com",
    "https://*.warpcast.com",
  ]) {
    t.true(csp.split(" ").includes(origin), origin);
  }
  t.false(csp.includes(" * "));
  t.false(csp.includes("http:"));
});

test("an upstream CSP keeps its own frame-ancestors", (t) => {
  const ours = SECURITY_HEADERS["Content-Security-Policy"];
  t.is(mergeFrameAncestors(undefined), ours);
  t.is(mergeFrameAncestors("default-src 'none';"), `default-src 'none'; ${ours}`);
  t.is(
    mergeFrameAncestors("default-src 'self'; frame-ancestors 'none'"),
    "default-src 'self'; frame-ancestors 'none'",
  );
});

test("Permissions-Policy keeps the features the site uses", (t) => {
  const policy = SECURITY_HEADERS["Permissions-Policy"];
  for (const off of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]) {
    t.true(policy.includes(off), off);
  }
  for (const used of [
    "clipboard-write",
    "web-share",
    "publickey-credentials-get",
    "publickey-credentials-create",
    "fullscreen",
    "autoplay",
  ]) {
    t.false(policy.includes(used), used);
  }
});

test("a short ADMIN_KEY logs a warning", (t) => {
  const warnings = [];
  const warn = (msg) => warnings.push(msg);
  t.true(checkAdminKey(undefined, warn));
  t.true(checkAdminKey("a".repeat(32), warn));
  t.is(warnings.length, 0);
  t.false(checkAdminKey("short", warn));
  t.is(warnings.length, 1);
  t.true(warnings[0].includes("ADMIN_KEY"));
});

test("parse is limited per IP with 429 and Retry-After", async (t) => {
  const { request } = await boot(t);
  for (let i = 0; i < 60; i++) {
    const res = await request("/api/v1/parse?url=x", { ip: "203.0.113.1" });
    t.is(res.status, 200);
  }
  const limited = await request("/api/v1/parse?url=x", { ip: "203.0.113.1" });
  t.is(limited.status, 429);
  t.is(limited.headers["retry-after"], "60");
  t.is(limited.headers["x-content-type-options"], "nosniff");
  const body = JSON.parse(limited.body);
  t.is(body.status, "error");
  t.is(body.code, 429);
  t.is(body.message, "Too Many Requests");

  // Another IP has its own count.
  const other = await request("/api/v1/parse?url=x", { ip: "203.0.113.2" });
  t.is(other.status, 200);
  // Other routes aren't limited.
  t.is((await request("/api/v1/feeds/hot", { ip: "203.0.113.1" })).status, 200);
  t.is((await request("/", { ip: "203.0.113.1" })).status, 200);
});

test("the window resets", async (t) => {
  const { request, clock } = await boot(t);
  const ip = "203.0.113.3";
  for (let i = 0; i < 60; i++) await request("/api/v1/metadata", { ip });
  clock.advance(45 * 1000);
  const limited = await request("/api/v1/metadata", { ip });
  t.is(limited.status, 429);
  t.is(limited.headers["retry-after"], "15");
  clock.advance(15 * 1000);
  t.is((await request("/api/v1/metadata", { ip })).status, 200);
});

test("admin routes: 10 requests per 15 minutes, whatever the outcome", async (t) => {
  const { request, clock } = await boot(t);
  const ip = "203.0.113.4";
  const paths = [
    ["GET", "/api/v1/cache/profile"],
    ["DELETE", "/api/v1/cache"],
    ["POST", "/api/v1/neynar/notify"],
    ["GET", "/API/v1/Cache/"],
  ];
  for (let i = 0; i < 10; i++) {
    const [method, path] = paths[i % paths.length];
    t.not((await request(path, { method, ip })).status, 429);
  }
  const limited = await request("/api/v1/cache", { method: "DELETE", ip });
  t.is(limited.status, 429);
  t.is(limited.headers["retry-after"], String(15 * 60));
  clock.advance(15 * 60 * 1000);
  t.is((await request("/api/v1/cache/profile", { ip })).status, 401);
});

test("search counts the API and the search page with a query", async (t) => {
  const { request } = await boot(t);
  const ip = "203.0.113.5";
  for (let i = 0; i < 30; i++) {
    await request("/api/v1/search", { method: "POST", ip });
    await request("/search?q=kiwi", { ip });
  }
  t.is((await request("/search?q=kiwi", { ip })).status, 429);
  // Preflights and the empty search sheet don't count.
  t.not((await request("/api/v1/search", { method: "OPTIONS", ip })).status, 429);
  t.is((await request("/search", { ip })).status, 200);
});

test("loopback requests no proxy forwarded aren't limited", async (t) => {
  const { request } = await boot(t);
  for (let i = 0; i < 70; i++) {
    t.is((await request("/api/v1/parse")).status, 200);
  }
});

test("CF-Connecting-IP and X-Forwarded-For are only trusted from loopback", (t) => {
  const req = (remoteAddress, headers = {}) => ({
    socket: { remoteAddress },
    headers,
  });
  t.is(
    clientIp(req("127.0.0.1", { "cf-connecting-ip": "198.51.100.7" })),
    "198.51.100.7",
  );
  t.is(
    clientIp(req("::ffff:127.0.0.1", { "cf-connecting-ip": "198.51.100.7" })),
    "198.51.100.7",
  );
  t.is(
    clientIp(req("::1", { "x-forwarded-for": "198.51.100.8, 162.158.1.1" })),
    "198.51.100.8",
  );
  // CF-Connecting-IP wins over X-Forwarded-For.
  t.is(
    clientIp(
      req("127.0.0.1", {
        "cf-connecting-ip": "198.51.100.7",
        "x-forwarded-for": "6.6.6.6",
      }),
    ),
    "198.51.100.7",
  );
  // Garbage in the header: fall back to the socket address.
  t.is(clientIp(req("127.0.0.1", { "cf-connecting-ip": "nope" })), "127.0.0.1");
  // A direct client can't choose its IP.
  t.is(
    clientIp(
      req("::ffff:203.0.113.9", {
        "cf-connecting-ip": "198.51.100.7",
        "x-forwarded-for": "198.51.100.7",
      }),
    ),
    "203.0.113.9",
  );
  // Cloudflare edges are only trusted where asked (the 8443 API).
  const fromEdge = req("162.158.10.20", { "cf-connecting-ip": "198.51.100.7" });
  t.is(clientIp(fromEdge), "162.158.10.20");
  t.is(clientIp(fromEdge, { trustCloudflare: true }), "198.51.100.7");
  t.true(isCloudflare("2606:4700::1"));
  t.false(isCloudflare("203.0.113.9"));
});

test("a spoofed CF-Connecting-IP from a direct client doesn't dodge the limit", async (t) => {
  let time = 0;
  const limit = rateLimit(API_RULES, { now: () => time });
  const statuses = [];
  for (let i = 0; i < 31; i++) {
    const req = {
      method: "POST",
      originalUrl: "/api/v1/messages?wait=false",
      socket: { remoteAddress: "203.0.113.10" },
      headers: { "cf-connecting-ip": `198.51.100.${i}` },
    };
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        statuses.push(code);
        return this;
      },
      json() {},
    };
    let passed = false;
    limit(req, res, () => (passed = true));
    if (passed) statuses.push(200);
  }
  t.is(statuses.filter((s) => s === 200).length, 30);
  t.is(statuses[30], 429);
});

test("eviction keeps memory bounded", (t) => {
  let time = 0;
  const limiter = createLimiter({
    limit: 1,
    windowMs: 1000,
    maxKeys: 100,
    now: () => time,
  });
  for (let i = 0; i < 1000; i++) limiter.hit(`ip${i}`);
  t.is(limiter.size(), 100);
  // The newest keys are kept and still counted.
  t.false(limiter.hit("ip999").allowed);
  // Expired windows go on the next hit.
  time += 1000;
  limiter.hit("fresh");
  t.is(limiter.size(), 1);
});

test("normalizePath matches the way express routes", (t) => {
  t.is(normalizePath("/API/v1/Cache/"), "/api/v1/cache");
  t.is(normalizePath("/api/v1/%63ache"), "/api/v1/cache");
  t.is(normalizePath("/"), "/");
  t.is(normalizePath("/%E0%A4%A"), "/%e0%a4%a");
});
