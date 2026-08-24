const CACHE_NAME = 'manlung-recovery-static-v1';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/css/style.css',
  '/css/admin.css',
  '/js/pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Never cache HTML pages: client/admin pages can contain authenticated data.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Static assets: network first, then cache, then normal failure.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
