const version = "2.0.0";
self.addEventListener("install", () => {
  console.log(`Installed Kiwi News service worker with version ${version}`);
  self.skipWaiting();
});
self.addEventListener("activate", () => {
  self.clients.claim();
});

  
self.addEventListener('push', function(event) {
  const payload = event.data.json();
  const options = {
    body: payload.message,
    data: payload.data,
    icon: 'apple-touch-icon.png',
  };
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
