/* Manlung Recovery — reliable floating contact controls bootstrap.
   Restores the known-working Call Admin/WebRTC + WhatsApp/Email controls.
   Does not replace or modify the WebRTC implementation. */
(() => {
  'use strict';
  if (window.__MANLUNG_CONTACT_BOOT__) return;
  window.__MANLUNG_CONTACT_BOOT__ = true;

  function load(src, marker) {
    return new Promise(resolve => {
      if (document.querySelector(`script[data-${marker}]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.dataset[marker] = 'true';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function boot() {
    // These are the original call files. They are loaded in order so the
    // contact menu can always find the #callWidgetBtn created by call-widget.js.
    await load('/js/call-webrtc.js?v=restore-20260908', 'manlung-call-webrtc');
    await load('/js/call-widget.js?v=restore-20260908', 'manlung-call-widget');
    await load('/js/support-fab.js?v=restore-20260908', 'manlung-support-fab');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
