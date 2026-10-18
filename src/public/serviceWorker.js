// NOTE: Web push was removed. Browsers that still have the old worker
// installed pick this up on their next update check and unregister it.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {
  self.registration.unregister();
});
