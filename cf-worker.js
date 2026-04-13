// Hosts whose images we will proxy through Cloudflare image resizing.
// This is an allowlist, not a blocklist: only sources listed here can
// be fetched through the /_img endpoint below. Prevents the endpoint
// from being used as a free general-purpose image CDN and blocks SSRF
// against internal hosts.
const IMAGE_PROXY_ALLOWED_HOSTS = new Set([
  "pbs.twimg.com",
  "api.ensdata.net",
]);

// Hosts we intentionally skip even if they show up in <img> tags:
// - imagedelivery.net: already Cloudflare Images, has its own variants
// - news.kiwistand.com: same-origin, Polish handles it
// - i.ytimg.com: YouTube thumbnails are already CDN-optimized and some
//   origins refuse requests from the CF resizer UA
// - localhost: dev
const IMAGE_PROXY_SKIP_HOSTS = new Set([
  "imagedelivery.net",
  "news.kiwistand.com",
  "i.ytimg.com",
  "localhost",
]);

// Default width for row thumbnails. The CSS renders these around
// 600px wide; 800 gives us some headroom for high-DPI screens without
// paying for full-resolution originals.
const IMAGE_PROXY_DEFAULT_WIDTH = 800;
const IMAGE_PROXY_MAX_WIDTH = 2048;
const IMAGE_PROXY_MIN_WIDTH = 16;
const IMAGE_PROXY_QUALITY = 75;
const IMAGE_PROXY_PATH = "/_img";
const IMAGE_PROXY_CACHE_CONTROL = "public, max-age=31536000, immutable";

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Image proxy endpoint — "Transform via Workers" mode. We do NOT
  // expose the public /cdn-cgi/image/ URL format. Instead, this
  // Worker-owned endpoint is the only way to trigger a resize, so we
  // fully control inputs (host allowlist, width clamping, SSRF
  // protection) and there is no general-purpose resize URL to abuse.
  if (url.pathname === IMAGE_PROXY_PATH) {
    return event.respondWith(handleImageProxy(event));
  }

  // Defense-in-depth: hard-block /cdn-cgi/image/ in case it's still
  // reachable on the zone. We route all resizes through the endpoint
  // above, so nothing legitimate should ever hit this path.
  if (url.pathname.startsWith("/cdn-cgi/image/")) {
    return event.respondWith(new Response("Forbidden", { status: 403 }));
  }

  if (url.pathname === "/api/v1/delegations") {
    return event.respondWith(fetch(event.request));
  }

  const path = url.pathname;
  const targetPaths = ["/profile"];
  const hasIdentityCookie = event.request.headers
    .get("Cookie")
    ?.includes("identity");

  if (targetPaths.includes(path) && !hasIdentityCookie) {
    const redirectUrl = new URL(url.origin);
    redirectUrl.pathname = "/";
    redirectUrl.search = url.search;
    event.respondWith(Response.redirect(redirectUrl.toString(), 302));
    return;
  }

  event.respondWith(swr({ request: event.request, event }));
});

// Serves a resized image for an allowlisted third-party source.
// Validates inputs, calls Cloudflare image resizing via fetch() with
// the `cf.image` options, and caches the result at the edge with a
// long immutable TTL (URLs include full source + width, so they are
// safely cacheable forever).
async function handleImageProxy(event) {
  const request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const src = url.searchParams.get("u");
  if (!src) return new Response("Missing 'u' parameter", { status: 400 });

  let parsed;
  try {
    parsed = new URL(src);
  } catch {
    return new Response("Invalid source URL", { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return new Response("Forbidden", { status: 403 });
  }
  if (!IMAGE_PROXY_ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response("Forbidden", { status: 403 });
  }

  const requestedWidth = Number(url.searchParams.get("w"));
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? Math.max(IMAGE_PROXY_MIN_WIDTH, Math.min(IMAGE_PROXY_MAX_WIDTH, Math.floor(requestedWidth)))
    : IMAGE_PROXY_DEFAULT_WIDTH;

  // Normalize the cache key so ?u=...&w=800 and ?w=800&u=... hit the
  // same cache entry regardless of query-string ordering.
  const cacheKeyUrl = new URL(url.origin + IMAGE_PROXY_PATH);
  cacheKeyUrl.searchParams.set("u", parsed.toString());
  cacheKeyUrl.searchParams.set("w", String(width));
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const imageRes = await fetch(parsed.toString(), {
    cf: {
      image: {
        width,
        quality: IMAGE_PROXY_QUALITY,
        format: "auto",
        fit: "scale-down",
      },
    },
  });

  if (!imageRes.ok) {
    // Don't cache failures — origins go up and down and we want to
    // recover the next time someone asks.
    return new Response("Upstream error", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  const headers = new Headers(imageRes.headers);
  headers.set("cache-control", IMAGE_PROXY_CACHE_CONTROL);
  headers.delete("set-cookie");
  headers.delete("cf-cache-status");

  const response = new Response(imageRes.body, {
    status: imageRes.status,
    headers,
  });

  event.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function shouldProxyImageSrc(src) {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  if (src.startsWith("/")) return false;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (IMAGE_PROXY_SKIP_HOSTS.has(parsed.hostname)) return false;
    return IMAGE_PROXY_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function buildProxyImageUrl(src, width) {
  return `${IMAGE_PROXY_PATH}?u=${encodeURIComponent(src)}&w=${width}`;
}

class ImgProxyRewriter {
  constructor(width) {
    this.width = width;
  }
  element(el) {
    const src = el.getAttribute("src");
    if (!shouldProxyImageSrc(src)) return;
    el.setAttribute("src", buildProxyImageUrl(src, this.width));
    // srcset would need per-candidate rewriting; for now we only touch
    // src and let the single-width transform handle high-DPI via the
    // browser's natural upscaling. Add srcset handling here if needed.
  }
}

// Rewrites <img src="..."> in HTML responses to route allowlisted
// third-party images through our image proxy endpoint. Returns the
// original response untouched for non-HTML content types.
function transformHtmlImages(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter()
    .on("img", new ImgProxyRewriter(IMAGE_PROXY_DEFAULT_WIDTH))
    .transform(response);
}

const CACHE_STALE_AT_HEADER = "x-edge-cache-stale-at";
const CACHE_STATUS_HEADER = "x-edge-cache-status";
const CACHE_CONTROL_HEADER = "Cache-Control";
const CLIENT_CACHE_CONTROL_HEADER = "x-client-cache-control";
const ORIGIN_CACHE_CONTROL_HEADER = "x-edge-origin-cache-control";

const CacheStatus = {
  HIT: "HIT",
  MISS: "MISS",
  REVALIDATING: "REVALIDATING",
};

async function swr({ request, event }) {
  const cache = caches.default;
  const cacheKey = toCacheKey(request);
  const cachedRes = await cache.match(cacheKey);

  if (cachedRes) {
    let cacheStatus = cachedRes.headers.get(CACHE_STATUS_HEADER);

    if (shouldRevalidate(cachedRes)) {
      cacheStatus = CacheStatus.REVALIDATING;

      // Clone the cached response before using it for cache.put
      const responseForCache = cachedRes.clone();
      
      // mark as revalidating so we don't double-fetch
      await cache.put(
        cacheKey,
        addHeaders(responseForCache, {
          [CACHE_STATUS_HEADER]: CacheStatus.REVALIDATING,
        }),
      );

      event.waitUntil(fetchAndCache({ cacheKey, request, event }));
    }

    return addHeaders(cachedRes, {
      [CACHE_STATUS_HEADER]: cacheStatus,
      [CACHE_CONTROL_HEADER]: cachedRes.headers.get(CLIENT_CACHE_CONTROL_HEADER),
    });
  }

  return fetchAndCache({ cacheKey, request, event });
}

async function fetchAndCache({ cacheKey, request, event }) {
  const cache = caches.default;
  const rawOriginRes = await fetch(request);  // No cache busting

  // Rewrite <img> tags before caching, so cache hits serve the
  // already-transformed HTML and don't pay the rewriter cost per request.
  // If the image allowlist or target width changes, purge the edge cache
  // via cloudflarePurge.mjs to pick up the new rules.
  const originRes = transformHtmlImages(rawOriginRes);

  const cacheControl = resolveCacheControlHeaders(request, originRes);
  const headers = {
    [ORIGIN_CACHE_CONTROL_HEADER]: originRes.headers.get("cache-control"),
    [CACHE_STALE_AT_HEADER]: cacheControl?.edge?.staleAt?.toString(),
    "x-origin-cf-cache-status": originRes.headers.get("cf-cache-status"),
  };

  // Clone for cache storage if needed
  if (cacheControl?.edge) {
    const responseForCache = originRes.clone();
    event.waitUntil(
      cache.put(
        cacheKey,
        addHeaders(responseForCache, {
          ...headers,
          [CACHE_STATUS_HEADER]: CacheStatus.HIT,
          [CACHE_CONTROL_HEADER]: cacheControl.edge.value,
          [CLIENT_CACHE_CONTROL_HEADER]: cacheControl.client,
          "set-cookie": null,
          "cf-cache-status": null,
          vary: null,
        }),
      ),
    );
  }

  return addHeaders(originRes, {
    ...headers,
    [CACHE_STATUS_HEADER]: CacheStatus.MISS,
    [CACHE_CONTROL_HEADER]: cacheControl?.client,
  });
}

function resolveCacheControlHeaders(req, res) {
  const shouldCache = res.ok && req.method === "GET";
  if (!shouldCache) {
    return { client: "public, max-age=0, must-revalidate" };
  }

  const raw = res.headers.get(CACHE_CONTROL_HEADER);
  if (!raw) return;

  const parsed = parseCacheControl(raw);
  return {
    edge: resolveEdgeCacheControl(parsed),
    client: resolveClientCacheControl(parsed),
  };
}

function resolveEdgeCacheControl({ sMaxage, staleWhileRevalidate }) {
  if (sMaxage === undefined) return;
  const staleAt = Date.now() + sMaxage * 1000;

  if (staleWhileRevalidate === 0) {
    return { value: "immutable", staleAt };
  }

  // Don't add staleWhileRevalidate to the cache time sent to Cloudflare
  // The worker handles SWR internally, Cloudflare should only cache for sMaxage
  return { 
    value: `max-age=${sMaxage}`, 
    staleAt 
  };
}

function resolveClientCacheControl({ maxAge }) {
  if (!maxAge) return "public, max-age=0, must-revalidate";
  return `max-age=${maxAge}`;
}

function parseCacheControl(value = "") {
  const parts = value.replace(/ +/g, "").split(",");
  return parts.reduce((result, part) => {
    const [key, val] = part.split("=");
    result[toCamelCase(key)] = val !== undefined ? Number(val) : true;
    return result;
  }, {});
}

function addHeaders(response, headers) {
  // Clone the response to avoid body consumption issues
  const resp = new Response(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  });

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      if (value === null) resp.headers.delete(key);
      else {
        resp.headers.delete(key);
        resp.headers.append(key, value);
      }
    }
  });

  return resp;
}

function toCamelCase(str) {
  return str.replace(/-./g, (x) => x[1].toUpperCase());
}

function toCacheKey(req) {
  return new Request(req.url, { method: req.method });
}

function shouldRevalidate(res) {
  const status = res.headers.get(CACHE_STATUS_HEADER);
  if (status === CacheStatus.REVALIDATING) return false;

  const staleAt = Number(res.headers.get(CACHE_STALE_AT_HEADER));
  if (!staleAt) return true;
  return Date.now() > staleAt;
}

function addCacheBustParam(request) {
  const url = new URL(request.url);
  url.searchParams.append("t", Date.now().toString());
  return new Request(url.toString(), request);
}
