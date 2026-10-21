// [v5] π App-shell service worker (production build only, registered by web/main.tsx in a secure context: localhost or
// LAN over HTTPS). It makes the trainer installable and opens the last app shell when the server cannot be reached.
// Never touches /api (live data), the LAN access-code landing (/?t=…), other origins or non-GET requests.
const SHELL = 'trainer-shell-v1';
const ASSETS = 'trainer-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    if (url.searchParams.has('t')) return; // access-code landing: always the server
    event.respondWith(page(req));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(req));
  }
});

/** Network first; a successful page becomes the cached shell (a new build drops the old hashed assets). */
async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL);
      const prev = await cache.match('/');
      const html = await res.clone().text();
      if (!prev || (await prev.text()) !== html) {
        await caches.delete(ASSETS);
        await cache.put('/', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      }
    }
    return res;
  } catch {
    const cached = await caches.match('/', { cacheName: SHELL });
    return cached || Response.error();
  }
}

/** Hashed file names never change content: cache first. */
async function asset(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}
