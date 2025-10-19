// ---- config ----
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',               // index.html (served at /)
  '/styles.css',
  '/scripts.js',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ---- install: pre-cache essential assets ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately after install
  self.skipWaiting();
});

// ---- activate: clean old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---- fetch: smart caching strategies ----
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  const requestURL = new URL(request.url);

  // HTML pages: network-first (fresh content when online, fallback to cache/offline)
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // Static assets (CSS/JS/images): cache-first (fast & offline-friendly)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Put a copy in runtime cache for next time
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => {
        // Optional: you could return a placeholder for images here
      });
    })
  );
});
