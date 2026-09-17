/* Manlung Recovery — reliable floating controls bootstrap.
   Restores the visible AI + Call controls and preserves the existing WebRTC implementation. */
(() => {
  'use strict';
  if (window.__MANLUNG_CONTACT_BOOT__) return;
  window.__MANLUNG_CONTACT_BOOT__ = true;

  function load(src, marker) {
    return new Promise(resolve => {
      if (document.querySelector(`script[data-${marker}]`)) { resolve(true); return; }
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.setAttribute('data-' + marker, 'true');
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function boot() {
    // Load the original WebRTC stack first; do not replace it.
    await load('/js/call-webrtc.js?v=restore-20260908', 'manlungCallWebRTC');
    await load('/js/call-widget.js?v=restore-20260908', 'manlungCallWidget');

    // Restore the contact menu around the Call Admin control.
    await load('/js/support-fab.js?v=restore-20260908', 'manlung-support-fab');

    // Also ensure the original functional AI implementation is loaded.
    await load('/js/manlung-ai.js?v=restore-20260908', 'manlung-functional-ai');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
