// Service worker for the performance-evaluation PWA (production only; the app
// registers it only when NODE_ENV=production).
//
// Safety rules:
//   * navigations are network-first and bypass the HTTP cache, so a new
//     deployment is never masked;
//   * API responses are never cached;
//   * `/_next/*` build output is NEVER cached — those filenames change between
//     builds and a stale chunk breaks hydration.
// The VERSION is bumped on every change so old caches purge on activate.
const VERSION = 'pe-cache-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cache API
  if (url.pathname.startsWith('/_next/')) return; // never cache build output

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'reload' }).catch(() => caches.match(req)));
    return;
  }

  // Only a small, stable set of same-origin static assets is cached.
  if (/^\/(icon\.svg|favicon\.ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
