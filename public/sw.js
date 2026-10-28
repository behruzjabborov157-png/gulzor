// Gulzor service worker.
// - Pages are always loaded from the network (prices, stock and orders must be live);
//   when the network is down, a navigation shows /offline.html instead of the browser error.
// - Hashed build files, icons and catalogue photos are cached (they never change under the same URL).
// - Admin pages, API callbacks, uploaded media and anything that is not a GET are never touched.
const VERSION = "gulzor-v1";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (cacheName === IMAGE_CACHE) trimCache(IMAGE_CACHE, MAX_IMAGES);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/") || path.startsWith("/media/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (path.startsWith("/_next/static/") || path.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (path.startsWith("/images/") || path.startsWith("/_next/image")) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
  }
});
