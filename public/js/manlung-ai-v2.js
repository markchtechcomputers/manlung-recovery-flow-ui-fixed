/* Manlung Recovery — restore the known-working public AI and contact controls.
   The functional AI lives in manlung-ai.js. This bootstrap deliberately loads that
   implementation instead of replacing it. It also loads support-fab.js directly so
   the floating Call Admin -> WhatsApp / Email menu is visible on the page. */
(() => {
  'use strict';
  if (window.__MANLUNG_RESTORED_FEATURES__) return;
  window.__MANLUNG_RESTORED_FEATURES__ = true;

  function load(src, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.dataset[marker] = 'true';
    document.head.appendChild(s);
  }

  function boot() {
    // This is the functional chat UI (the one that creates #manlungAiButton).
    load('/js/manlung-ai.js?v=20260908-restore', 'manlung-functional-ai');

    // This is the restored floating contact menu. It does not alter WebRTC.
    load('/js/support-fab.js?v=20260908-restore', 'manlung-support-fab');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
