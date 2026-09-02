const CACHE_NAME = "my-market-tracker-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Por ahora dejamos pasar todas las peticiones normalmente a la red.
// Esto cumple el requisito técnico de "service worker registrado"
// que los navegadores piden para poder instalar la app.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
