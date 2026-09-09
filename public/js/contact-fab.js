/* Manlung Recovery — floating contact controls bootstrap.
   Loads the restored contact menu without changing the WebRTC implementation. */
(() => {
  'use strict';
  function load() {
    if (document.querySelector('script[data-manlung-support-fab]')) return;
    const s = document.createElement('script');
    s.src = '/js/support-fab.js?v=restore-1';
    s.defer = true;
    s.dataset.manlungSupportFab = 'true';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();
