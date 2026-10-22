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
// - Any CSP directive but frame-ancestors (a separate step).

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
      res.setHeader(
        "Content-Security-Policy",
        mergeFrameAncestors(res.getHeader("Content-Security-Policy")),
      );
    }
    return writeHead.apply(this, args);
  };
  next();
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
