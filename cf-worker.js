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
    const gatewayUrl = new URL(url.origin);
    gatewayUrl.pathname = "/kiwipass-mint";
    gatewayUrl.search = url.search;
    event.respondWith(Response.redirect(gatewayUrl.toString(), 302));
    return;
  }

  event.respondWith(swr({ request: event.request, event }));
});

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
  const originRes = await fetch(request);  // No cache busting

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
