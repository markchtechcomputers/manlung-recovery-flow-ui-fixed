const CACHE_NAME = 'manlung-recovery-static-v5';

const STATIC_ASSETS = [
  '/',
  '/about.html',
  '/contact.html',
  '/privacy.html',
  '/blog.html',
  '/careers.html',
  '/donate.html',
  '/knowledge.html',
  '/link-scanner.html',
  '/terms.html',
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
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  // Authentication and API responses must always use the network.
  if (requestUrl.pathname.startsWith('/api/') ||
      requestUrl.pathname === '/login.html' ||
      requestUrl.pathname === '/oauth-callback.html' ||
      requestUrl.pathname.startsWith('/admin/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, authentication, call, signaling, or other dynamic data.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => {
          // Only return cached public pages. Never substitute a private page
          // with another cached document.
          const publicPages = new Set([
            '/', '/about.html', '/blog.html', '/careers.html',
            '/donate.html', '/knowledge.html', '/link-scanner.html', '/terms.html', '/contact.html', '/privacy.html'
          ]);
          if (publicPages.has(url.pathname)) {
            return caches.match(request).then(cached => cached || new Response(
              OFFLINE_PAGE,
              {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store'}}
            ));
          }
          return new Response(
            OFFLINE_PAGE,
            {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store'}}
          );
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
