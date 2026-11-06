const CACHE_NAME = 'manlung-recovery-static-v57';
const OFFLINE_PAGE = '/offline';
const STATIC_ASSETS = [
  OFFLINE_PAGE,
  '/', '/about', '/blog', '/careers', '/contact', '/donate',
  '/knowledge', '/services', '/terms', '/privacy', '/login',
  '/reset-password', '/oauth-callback', '/client/request', '/client/track',
  '/manifest.webmanifest', '/favicon.svg', '/manlung-ai', '/css/style.css', '/css/theme.css', '/css/footer.css', '/css/mobile-layout-stability.css', '/js/theme.js',
  '/js/pwa.js', '/js/cookie-consent.js', '/js/call-webrtc.js', '/js/call-widget.js', '/js/contact-fab.js',
  '/js/support-fab.js', '/js/manlung-ai-v2.js', '/js/manlung-ai.js',
  '/css/case-flow-animation.css', '/js/case-flow-animation.js', '/css/home-premium.css',
  '/js/home-premium.js', '/icons/icon-192.png', '/icons/icon-512.png'
];
async function cachedOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  return await cache.match(OFFLINE_PAGE) || new Response('Manlung Recovery is offline. Reconnect and try again.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(OFFLINE_PAGE);
    await Promise.allSettled(STATIC_ASSETS.filter(path => path !== OFFLINE_PAGE).map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('manlung-recovery-static-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('__manlung_probe')) return;
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      if (url.pathname === OFFLINE_PAGE) {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(OFFLINE_PAGE, response.clone());
          }
          // HTTP errors are server responses, not proof of lost connectivity.
          return response;
        } catch (_) {
          return await cachedOfflinePage();
        }
      }
      try {
        // Preserve 4xx/5xx responses for the browser; only network failures
        // should redirect to the offline fallback.
        return await fetch(request, { cache: 'no-store' });
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
