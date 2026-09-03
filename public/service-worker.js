const CACHE_NAME = 'manlung-recovery-static-v5';

// Only public/static pages are cached. Authenticated dashboards, settings,
// admin pages, API responses, evidence, and other private data stay network-only.
const STATIC_ASSETS = [
  '/',
  '/about.html',
  '/blog.html',
  '/careers.html',
  '/contact.html',
  '/donate.html',
  '/knowledge.html',
  '/link-scanner.html',
  '/terms.html',
  '/privacy.html',
  '/login.html',
  '/reset-password.html',
  '/client/request.html',
  '/client/track.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/css/style.css',
  '/css/theme.css',
  '/js/theme.js',
  '/js/pwa.js',
  '/js/link-scanner.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const PUBLIC_DOCUMENTS = new Set([
  '/',
  '/about.html',
  '/blog.html',
  '/careers.html',
  '/contact.html',
  '/donate.html',
  '/knowledge.html',
  '/link-scanner.html',
  '/terms.html',
  '/privacy.html',
  '/login.html',
  '/reset-password.html',
  '/client/request.html',
  '/client/track.html'
]);

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>Manlung Recovery · Offline</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fff;color:#172033}
main{max-width:520px;text-align:center;border:1px solid #dbe3ef;border-radius:18px;padding:32px;box-shadow:0 12px 35px rgba(2,6,23,.1)}
h1{margin-top:0}p{line-height:1.6;color:#526174}
</style>
</head>
<body><main><h1>You are offline</h1><p>Manlung Recovery could not connect to the server. Private account information is not stored for offline use.</p><p>Reconnect to the internet and try again.</p></main></body>
</html>`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(error => console.warn('PWA static cache incomplete:', error))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(async () => {
        if ('navigationPreload' in self.registration) {
          try { await self.registration.navigationPreload.enable(); } catch {}
        }
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, authentication endpoints, calls, signaling, evidence,
  // or other dynamic data.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    if (!PUBLIC_DOCUMENTS.has(url.pathname)) {
      // Private/authenticated pages remain network-only for security.
      event.respondWith(
        (event.preloadResponse || fetch(request)).catch(() => new Response(
          OFFLINE_PAGE,
          {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store'}}
        ))
      );
      return;
    }

    // Public pages use cache-first navigation so an installed PWA opens
    // immediately instead of waiting on the network. A background refresh
    // keeps the next launch up to date without delaying the current click.
    event.respondWith(
      caches.match(request).then(cached => {
        const refresh = (event.preloadResponse || fetch(request))
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached || new Response(
            OFFLINE_PAGE,
            {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store'}}
          ));

        return cached || refresh;
      })
    );
    return;
  }

  // Cache only known static assets. Do not turn this into a general-purpose
  // cache for arbitrary responses.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
