// Third-party <img> sources in rendered HTML get uploaded to Cloudflare
// Images on first encounter and their src is rewritten to the resulting
// imagedelivery.net URL on subsequent renders. End result: all images
// in kiwistand pages are served from Cloudflare Images, giving us free
// resize/format negotiation with no public transform endpoint to
// protect. Uploads run in the background via event.waitUntil, so the
// first visitor to a new image still gets a working (un-optimized)
// page — the second visitor at the same edge PoP gets the optimized
// one.
//
// Requires two bindings on the Worker:
//   - IMAGE_KV      (Workers KV namespace for src -> imagedelivery URL)
//   - CF_API_TOKEN  (secret, Cloudflare Images: Edit scope)
//   - CF_ACCOUNT_ID (plain var, your CF account ID)

// Hosts we do NOT upload:
//   - imagedelivery.net: already Cloudflare Images
//   - news.kiwistand.com: same-origin, Polish handles it
//   - i.ytimg.com: YouTube thumbnails are already CDN-optimized and
//     some origins reject the CF Images fetcher
//   - ensdata.net, openseauserdata.com: avatars — small, numerous,
//     per-user; uploading them bloats CF Images storage without any
//     meaningful performance win
//   - localhost: dev
const IMAGE_SKIP_HOSTS = new Set([
  "imagedelivery.net",
  "news.kiwistand.com",
  "i.ytimg.com",
  "ensdata.net",
  "openseauserdata.com",
  "localhost",
]);

// KV key prefix and TTL for the src -> imagedelivery.net mapping.
// Mappings live for a year and refresh naturally as they're re-used.
const IMAGE_MAP_PREFIX = "img-map:";
const IMAGE_MAP_TTL_SECONDS = 60 * 60 * 24 * 365;

// Pending-upload sentinel. When we kick off an upload we write a short-
// lived marker so concurrent renders of the same story don't race and
// trigger duplicate uploads from the same edge. Value "-" is a sentinel
// meaning "upload in progress, don't start another".
const IMAGE_PENDING_SENTINEL = "-";
const IMAGE_PENDING_TTL_SECONDS = 120;

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

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

function shouldUploadImage(src) {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  if (src.startsWith("/")) return false;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (IMAGE_SKIP_HOSTS.has(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// HTMLRewriter element handler. For each <img src> pointing at a
// third-party host we look up an existing mapping in KV and rewrite
// src if present; otherwise we leave the original URL in place and
// schedule a background upload so future renders at this edge get the
// optimized version.
class ImgUploadRewriter {
  constructor(event) {
    this.event = event;
  }
  async element(el) {
    if (typeof IMAGE_KV === "undefined") return;
    const src = el.getAttribute("src");
    if (!shouldUploadImage(src)) return;

    const key = IMAGE_MAP_PREFIX + src;
    let mapped;
    try {
      mapped = await IMAGE_KV.get(key);
    } catch {
      return;
    }

    if (mapped && mapped !== IMAGE_PENDING_SENTINEL) {
      el.setAttribute("src", mapped);
      return;
    }

    if (mapped === IMAGE_PENDING_SENTINEL) {
      // Another render already kicked off an upload for this URL;
      // leave the original src in place and wait it out.
      return;
    }

    // First time seeing this URL at this edge. Mark pending and kick
    // off the upload in the background.
    this.event.waitUntil(uploadImageToCfImages(src, key));
  }
}

async function uploadImageToCfImages(src, key) {
  if (
    typeof IMAGE_KV === "undefined" ||
    typeof CF_API_TOKEN === "undefined" ||
    typeof CF_ACCOUNT_ID === "undefined"
  ) {
    return;
  }

  // Claim the upload so concurrent handlers back off. KV writes are
  // eventually consistent across edges, so this only prevents duplicate
  // uploads from the *same* edge in close succession — good enough.
  try {
    await IMAGE_KV.put(key, IMAGE_PENDING_SENTINEL, {
      expirationTtl: IMAGE_PENDING_TTL_SECONDS,
    });
  } catch {
    return;
  }

  let deliveryUrl;
  try {
    const form = new FormData();
    form.append("url", src);
    form.append("requireSignedURLs", "false");

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
        body: form,
      },
    );

    if (!res.ok) {
      // Clear the pending marker so a future render can retry.
      await IMAGE_KV.delete(key).catch(() => {});
      return;
    }

    const data = await res.json();
    if (!data?.success || !data.result?.variants?.length) {
      await IMAGE_KV.delete(key).catch(() => {});
      return;
    }

    // CF Images returns a list of variant URLs, e.g.
    //   https://imagedelivery.net/<hash>/<id>/public
    // The "public" variant is the default full-image delivery.
    deliveryUrl =
      data.result.variants.find((v) => v.endsWith("/public")) ||
      data.result.variants[0];
  } catch {
    await IMAGE_KV.delete(key).catch(() => {});
    return;
  }

  if (!deliveryUrl) return;

  try {
    await IMAGE_KV.put(key, deliveryUrl, {
      expirationTtl: IMAGE_MAP_TTL_SECONDS,
    });
  } catch {
    // If the final write fails, leave the pending marker to expire
    // naturally so a future render can retry.
  }
}

// Runs HTMLRewriter over text/html responses before they are cached
// by the SWR layer. Non-HTML responses pass through untouched.
function transformHtmlImages(response, event) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  return new HTMLRewriter()
    .on("img", new ImgUploadRewriter(event))
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
  let rawOriginRes;
  try {
    rawOriginRes = await fetch(addCacheBustParam(request), { cf: { cacheEverything: false } });
  } catch (err) {
    console.error("SWR fetch failed:", err.message, request.url);
    return new Response("Origin fetch failed", { status: 502 });
  }

  console.log("SWR fetch:", request.url, "status:", rawOriginRes.status,
    "cc:", rawOriginRes.headers.get("cache-control"));

  // Rewrite <img> tags before caching, so cache hits serve the
  // already-transformed HTML and don't pay the rewriter cost per request.
  // If the image allowlist or target width changes, purge the edge cache
  // via cloudflarePurge.mjs to pick up the new rules.
  const originRes = transformHtmlImages(rawOriginRes, event);

  const cacheControl = resolveCacheControlHeaders(request, originRes);
  const headers = {
    [ORIGIN_CACHE_CONTROL_HEADER]: originRes.headers.get("cache-control"),
    [CACHE_STALE_AT_HEADER]: cacheControl?.edge?.staleAt?.toString(),
    "x-origin-cf-cache-status": originRes.headers.get("cf-cache-status"),
  };

  // Clone for cache storage if needed
  if (cacheControl?.edge) {
    const responseForCache = originRes.clone();
    console.log("SWR cache.put:", request.url, "max-age:", cacheControl.edge.value);
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
      ).then(() => console.log("SWR cache.put OK:", request.url))
        .catch((err) => console.error("SWR cache.put FAILED:", request.url, err.message)),
    );
  } else {
    console.warn("SWR no edge cache:", request.url, "ok:", rawOriginRes.ok,
      "cacheControl:", JSON.stringify(cacheControl));
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

  // Keep response in CF cache long enough for SWR to work. Use 10x
  // sMaxage as retention — long enough to serve stale while revalidating,
  // short enough that stuck entries self-heal.
  const cacheSeconds = sMaxage * 10;
  return {
    value: `max-age=${cacheSeconds}`,
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
  const staleAt = Number(res.headers.get(CACHE_STALE_AT_HEADER));
  if (!staleAt) return true;

  const now = Date.now();
  if (now <= staleAt) return false; // still fresh

  const status = res.headers.get(CACHE_STATUS_HEADER);
  if (status === CacheStatus.REVALIDATING) {
    // If stuck in REVALIDATING for over 30s, retry
    return (now - staleAt) > 30000;
  }
  return true;
}

function addCacheBustParam(request) {
  const url = new URL(request.url);
  url.searchParams.append("t", Date.now().toString());
  return new Request(url.toString(), request);
}
