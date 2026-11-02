//@format
// NOTE: Security headers for every response. The load balancer
// (load-balancer.mjs) sets them before proxying, so all pages, API responses,
// static files and 404s from the primary and the workers get them, and so do
// the load balancer's own errors (e.g. a 502 while a worker restarts). The
// node API on port 8443 (api.mjs) isn't behind the load balancer and uses the
// same middleware. An upstream response that sets one of these headers itself
// wins, as http-proxy copies upstream headers over ours.
//
// Not set on purpose:
// - X-Frame-Options: it can only say DENY or SAMEORIGIN, and Farcaster clients
//   frame the site as a mini app. CSP frame-ancestors does it with an allowlist.
// - CSP directives for styles, images, fonts, connections and frames: only
//   frame-ancestors and the script policy below.
import { env } from "process";
import express from "express";

import log from "./logger.mjs";

// Hosts allowed to frame the site. The Farcaster web client renders mini apps
// in an iframe (farcaster.xyz, formerly warpcast.com, plus their subdomains
// such as the developer preview tool); the Base app and Coinbase Wallet render
// Farcaster mini apps too. On phones these clients use a web view, which
// frame-ancestors doesn't affect.
export const FRAME_ANCESTORS = [
  "'self'",
  "https://kiwistand.com",
  "https://*.kiwistand.com",
  "https://farcaster.xyz",
  "https://*.farcaster.xyz",
  "https://warpcast.com",
  "https://*.warpcast.com",
  "https://base.app",
  "https://*.base.app",
  "https://base.dev",
  "https://*.base.dev",
  "https://base.org",
  "https://*.base.org",
  "https://wallet.coinbase.com",
];

// Browser features the site doesn't use, turned off for it and every iframe
// it embeds. Left on (by not listing them): clipboard-write (share and copy
// buttons), web-share (navigator.share), publickey-credentials-get/-create
// (passkeys), fullscreen, autoplay and picture-in-picture (embedded media).
export const DISABLED_FEATURES = [
  "accelerometer",
  "bluetooth",
  "browsing-topics",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "idle-detection",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
  "xr-spatial-tracking",
];

export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": DISABLED_FEATURES.map((f) => `${f}=()`).join(", "),
  "Content-Security-Policy": `frame-ancestors ${FRAME_ANCESTORS.join(" ")}`,
};

const FRAME_ANCESTORS_DIRECTIVE = SECURITY_HEADERS["Content-Security-Policy"];

// NOTE: Where pages may load scripts from. Without 'unsafe-inline', markup
// that ends up in a page unescaped can't run anything: no script element, no
// on…= attribute, no javascript: URL. The third parties are pinned to paths,
// so such markup can't load another Google Tag Manager container or PostHog
// project from the same hosts either. 'report-sample' adds the first 40
// characters of what was blocked to the report.
export const SCRIPT_SOURCES = [
  "'self'",
  "'report-sample'",
  // Google Analytics' gtag.js (public/conditional-tracking.js).
  "https://www.googletagmanager.com/gtag/",
  // What posthog-js loads when needed (src/web/src/main.jsx): session
  // recording, surveys, web vitals, exception autocapture, and our project's
  // remote config.
  "https://eu-assets.i.posthog.com/static/",
  "https://eu-assets.i.posthog.com/array/phc_F3mfkyH5tKKSVxnMbJf0ALcPA98s92s3Jw8a7eqpBGw/",
  // `npm run dev` loads the bundle from Vite (views/components/footer.mjs).
  ...(env.NODE_ENV === "production"
    ? []
    : [
        `${env.CUSTOM_PROTOCOL || "http://"}${env.CUSTOM_HOST_NAME || "localhost:5173"}`,
      ]),
];

export const CSP_REPORT_PATH = "/api/v1/csp-report";

export const SCRIPT_POLICY = [
  `script-src ${SCRIPT_SOURCES.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  `report-uri ${CSP_REPORT_PATH}`,
].join("; ");

// HTML pages get the script policy as Content-Security-Policy-Report-Only:
// the templates' inline on…= handlers still have to move into the bundle
// before it can be enforced. Not the docs at /docs: their build inlines
// scripts (theme, router payload) that change with every build, and they
// only show the text of the repo's docs/ folder.
function isPage(req, res) {
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  const type = String(res.getHeader("Content-Type") || "");
  return /^text\/html/i.test(type) && !/^\/docs(\/|$)/i.test(path);
}

// An upstream CSP replaces ours when http-proxy copies the upstream headers
// (express's default 404 page sends "default-src 'none'"). Keep it, but add
// our frame-ancestors when it has none.
export function mergeFrameAncestors(csp) {
  if (!csp) return FRAME_ANCESTORS_DIRECTIVE;
  const value = Array.isArray(csp) ? csp.join(", ") : String(csp);
  if (/(^|[;,]\s*)frame-ancestors\s/i.test(value)) return value;
  return `${value.replace(/[;\s]+$/, "")}; ${FRAME_ANCESTORS_DIRECTIVE}`;
}

export function securityHeaders(req, res, next) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.headersSent) {
      let csp = mergeFrameAncestors(res.getHeader("Content-Security-Policy"));
      if (isPage(req, res)) {
        res.setHeader("Content-Security-Policy-Report-Only", SCRIPT_POLICY);
      }
      res.setHeader("Content-Security-Policy", csp);
    }
    return writeHead.apply(this, args);
  };
  next();
}

// NOTE: Browsers POST what the script policy blocked (or would have, while
// report-only) to CSP_REPORT_PATH: one application/csp-report per violation
// for report-uri, or a batch as application/reports+json (Reporting API).
// Each violation is one log line: the directive, where the script came from
// (an origin, or "inline", "eval"…) and the page's path. No query strings
// (they can carry tokens or search terms), no IPs.
const REPORT_TYPES = ["application/csp-report", "application/reports+json"];

function source(value) {
  try {
    const url = new URL(value);
    return url.origin === "null" || url.protocol === "blob:"
      ? url.protocol
      : url.origin;
  } catch (err) {
    return /^[a-z-]{1,32}$/i.test(value) ? value : "unknown";
  }
}

function pathname(value) {
  try {
    return new URL(value).pathname.slice(0, 200);
  } catch (err) {
    return "unknown";
  }
}

function violations(body) {
  const reports = Array.isArray(body)
    ? body.filter((r) => r?.type === "csp-violation").map((r) => r.body)
    : [body?.["csp-report"]];
  return reports
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const directive = String(
        r.effectiveDirective ||
          r["effective-directive"] ||
          r["violated-directive"] ||
          "",
      ).split(" ")[0];
      return {
        directive: /^[a-z-]{1,40}$/.test(directive) ? directive : "unknown",
        blocked: source(String(r.blockedURL ?? r["blocked-uri"] ?? "")),
        page: pathname(r.documentURL ?? r["document-uri"]),
        sample: String(r.sample ?? r["script-sample"] ?? "").slice(0, 40),
      };
    });
}

export function cspReport({ write = log } = {}) {
  return [
    express.json({ type: REPORT_TYPES, limit: "16kb" }),
    (req, res) => {
      if (!req.is(REPORT_TYPES)) return res.sendStatus(415);
      for (const v of violations(req.body)) {
        const sample = v.sample ? ` ${JSON.stringify(v.sample)}` : "";
        write(`CSP report: ${v.directive} ${v.blocked} on ${v.page}${sample}`);
      }
      res.sendStatus(204);
    },
    (err, req, res, next) => res.sendStatus(err.status === 413 ? 413 : 400),
  ];
}

// NOTE: ADMIN_KEY guards the admin routes (requireAdminAuth in http.mjs). The
// admin routes are rate limited per IP, but a short key is still guessable.
export const MIN_ADMIN_KEY_LENGTH = 32;
export function checkAdminKey(key, warn = console.warn) {
  if (key && key.length < MIN_ADMIN_KEY_LENGTH) {
    warn(
      `WARNING: ADMIN_KEY is only ${key.length} characters long. Use at least ${MIN_ADMIN_KEY_LENGTH} random characters, e.g. \`openssl rand -hex 32\`.`,
    );
    return false;
  }
  return true;
}
