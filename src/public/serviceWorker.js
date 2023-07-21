const name = "kiwi-news-cache";
self.addEventListener("install", () => {
  console.log("Installed network-first caching service worker");
});

self.addEventListener("fetch", (event) => {
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(name);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cache = await caches.open(name);
    const cached = await cache.match(request);
    return cached || new Response('Sorry, not available.', { status: 503 });
  }
}
