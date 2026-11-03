const CACHE_NAME = 'manlung-recovery-static-v43';
const OFFLINE_PAGE = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_PAGE,
  '/', '/about.html', '/blog.html', '/careers.html', '/contact.html', '/donate.html',
  '/knowledge.html', '/services.html', '/terms.html', '/privacy.html', '/login.html',
  '/reset-password.html', '/oauth-callback.html', '/client/request.html', '/client/track.html',
  '/manifest.webmanifest', '/favicon.svg', '/css/style.css', '/css/theme.css', '/js/theme.js',
  '/js/pwa.js', '/js/cookie-consent.js', '/js/call-webrtc.js', '/js/call-widget.js', '/js/contact-fab.js',
  '/js/support-fab.js', '/js/manlung-ai-v2.js', '/js/manlung-ai.js',
  '/css/case-flow-animation.css', '/js/case-flow-animation.js', '/css/home-premium.css',
  '/js/home-premium.js', '/icons/icon-192.png', '/icons/icon-512.png'
];
async function cachedOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  return await cache.match(OFFLINE_PAGE) ||
    new Response('Manlung Recovery is offline. Reconnect and try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // The offline page is mandatory: do not activate this worker unless it is safely cached.
    await cache.add(OFFLINE_PAGE);
    await Promise.allSettled(STATIC_ASSETS.filter(path => path !== OFFLINE_PAGE).map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      key.startsWith('manlung-recovery-static-') && key !== CACHE_NAME
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Let the offline screen test the real network, not a cached service-worker response.
  if (url.searchParams.has('__manlung_probe')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      if (url.pathname === OFFLINE_PAGE) {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(OFFLINE_PAGE, response.clone());
            return response;
          }
        } catch (_) {}
        return await cachedOfflinePage();
      }
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) return response;
        throw new Error('Navigation request failed');
      } catch (_) {
        const offlineUrl = new URL(OFFLINE_PAGE, self.location.origin);
        offlineUrl.searchParams.set('return', request.url);
        return Response.redirect(offlineUrl.href, 302);
      }
    })());
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(request) || new Response('', { status: 504 });
      }
    })());
  }
});
