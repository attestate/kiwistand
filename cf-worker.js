// Hosts we will proxy through Cloudflare image resizing. This is an
// allowlist, not a blocklist: only images whose source host appears here
// get rewritten, and the /cdn-cgi/image/ endpoint itself rejects any
// source not in this set. That way, even if someone discovers the
// resizer URL they cannot point it at arbitrary origins and use our
// zone as a free image CDN.
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
const IMAGE_PROXY_QUALITY = 75;
const CDN_CGI_IMAGE_PREFIX = "/cdn-cgi/image/";

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Guard the Cloudflare image resizing endpoint. Only sources on the
  // allowlist may be transformed; everything else gets a 403. This is
  // the abuse-protection layer — without it, /cdn-cgi/image/ would let
  // anyone resize any image through our zone.
  //
  // Note: depending on how Image Resizing is configured on the zone,
  // these requests may be intercepted by Cloudflare before the Worker
  // runs. If that's the case this guard is a no-op and a WAF rule or
  // "Resize via Workers only" setting should be used instead. Leaving
  // the guard in place is harmless either way.
  if (url.pathname.startsWith(CDN_CGI_IMAGE_PREFIX)) {
    if (!isAllowedImageRequest(url)) {
      return event.respondWith(new Response("Forbidden", { status: 403 }));
    }
    return event.respondWith(fetch(event.request));
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

// Parse the source URL out of a /cdn-cgi/image/OPTIONS/SOURCE path and
// check it against the allowlist.
function isAllowedImageRequest(url) {
  const remainder = url.pathname.slice(CDN_CGI_IMAGE_PREFIX.length);
  const firstSlash = remainder.indexOf("/");
  if (firstSlash === -1) return false;
  const sourcePath = remainder.slice(firstSlash + 1);
  // The source URL was passed through as-is (not encoded) by our
  // rewriter, so its own query string will be merged into url.search.
  // Reconstruct by appending it.
  const sourceRaw = sourcePath + url.search;
  try {
    const parsed = new URL(sourceRaw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    return IMAGE_PROXY_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
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

function buildCfImageUrl(src, width) {
  const opts = `width=${width},quality=${IMAGE_PROXY_QUALITY},format=auto`;
  return `${CDN_CGI_IMAGE_PREFIX}${opts}/${src}`;
}

class ImgProxyRewriter {
  constructor(width) {
    this.width = width;
  }
  element(el) {
    const src = el.getAttribute("src");
    if (!shouldProxyImageSrc(src)) return;
    el.setAttribute("src", buildCfImageUrl(src, this.width));
    // srcset would need per-candidate rewriting; for now we only touch
    // src and let the single-width transform handle high-DPI via the
    // browser's natural upscaling. Add srcset handling here if needed.
  }
}

// Rewrites <img src="..."> in HTML responses to route allowlisted
// third-party images through Cloudflare's image resizer. Returns the
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
