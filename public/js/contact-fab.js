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
      s.dataset[marker] = 'true';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function addLoadingIndicator() {
    if (document.getElementById('manlung-page-loading')) return;
    const style = document.createElement('style');
    style.id = 'manlung-page-loading-style';
    style.textContent = `
      #manlung-page-loading{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483646;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.18);opacity:1;transition:opacity .35s ease}
      #manlung-page-loading img{width:46px;height:46px;border-radius:12px;object-fit:contain;display:block}
      #manlung-page-loading:after{content:"";position:absolute;inset:-7px;border:3px solid rgba(37,99,235,.18);border-top-color:#2563eb;border-right-color:#22c55e;border-radius:50%;animation:manlungPageSpin .8s linear infinite}
      @keyframes manlungPageSpin{to{transform:rotate(360deg)}}
      #manlung-page-loading.hide{opacity:0;pointer-events:none}
    `;
    document.head.appendChild(style);
    const box = document.createElement('div');
    box.id = 'manlung-page-loading';
    box.setAttribute('aria-label','Loading Manlung Recovery');
    box.innerHTML = '<img src="/icons/icon-512.png" alt="Manlung Recovery">';
    document.body.appendChild(box);
  }

  function finishLoadingIndicator() {
    const box = document.getElementById('manlung-page-loading');
    if (!box) return;
    box.classList.add('hide');
    setTimeout(() => box.remove(), 450);
  }

  async function boot() {
    addLoadingIndicator();

    // Load the original WebRTC stack first; do not replace it.
    await load('/js/call-webrtc.js?v=restore-20260908', 'manlung-call-webrtc');
    await load('/js/call-widget.js?v=restore-20260908', 'manlung-call-widget');

    // Restore the contact menu around the Call Admin control.
    await load('/js/support-fab.js?v=restore-20260908', 'manlung-support-fab');

    // Also ensure the original functional AI implementation is loaded.
    await load('/js/manlung-ai.js?v=restore-20260908', 'manlung-functional-ai');

    // Give dynamically-created controls a moment to render, then remove the loading mark.
    setTimeout(finishLoadingIndicator, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
