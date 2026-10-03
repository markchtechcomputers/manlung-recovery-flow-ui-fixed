/* Manlung Recovery — compatibility shim + CSRF bootstrap.
   Contact choices remain integrated into call-widget.js. WebRTC implementation is untouched. */
(() => {
  'use strict';
  window.__MANLUNG_SUPPORT_FAB__ = true;

  // inputSecurity creates this readable CSRF cookie on the first API request.
  // Attach it only to same-origin state-changing API calls so authenticated
  // bearer-token calls cannot be rejected because the header was omitted.
  if (window.__MANLUNG_CSRF_FETCH_PATCH__) return;
  window.__MANLUNG_CSRF_FETCH_PATCH__ = true;

  function csrfToken() {
    const names = ['__Host-mlc_csrf', 'mlc_csrf'];
    for (const name of names) {
      const prefix = `${name}=`;
      const item = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(prefix));
      if (item) {
        try { return decodeURIComponent(item.slice(prefix.length)); } catch (_) { return null; }
      }
    }
    return null;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function manlungCsrfFetch(input, init = {}) {
    try {
      const url = new URL(typeof input === 'string' ? input : input?.url || '', location.href);
      const method = String(init.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET').toUpperCase();
      if (url.origin === location.origin && url.pathname.startsWith('/api/') && ['POST','PUT','PATCH','DELETE'].includes(method)) {
        const token = csrfToken();
        if (token) {
          const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined));
          if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', token);
          init = { ...init, headers };
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();
