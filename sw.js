// Security Engineering Sprint — service worker
// Strategy:
//   Same-origin (the app itself): NETWORK-FIRST with cache fallback, so new
//   Vercel deploys propagate on next load, while offline still works.
//   Cross-origin (cdnjs React/Babel, Google Fonts): CACHE-FIRST, so the app
//   keeps loading even if a CDN is slow, down, or you're offline.
const CACHE = "se-sprint-v1";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  if (url.origin === self.location.origin) {
    // Network-first
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => {
            if (cached) return cached;
            if (e.request.mode === "navigate") return caches.match("./index.html");
            return Response.error();
          })
        )
    );
  } else {
    // Cache-first (CDN scripts, fonts) — opaque responses are cacheable
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
  }
});
