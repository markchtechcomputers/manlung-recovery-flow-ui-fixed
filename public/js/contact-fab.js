/* Manlung Recovery — lightweight site preloader. */
(function () {
  'use strict';
  function installPreloader() {
    if (document.getElementById('manlung-site-preloader')) return;
    const style = document.createElement('style');
    style.id = 'manlung-site-preloader-style';
    style.textContent = `
      #manlung-site-preloader { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: #ffffff; opacity: 1; visibility: visible; transition: opacity .35s ease, visibility .35s ease; }
      #manlung-site-preloader.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
      #manlung-site-preloader .preloader-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
      #manlung-site-preloader .preloader-logo { width: 58px; height: 58px; object-fit: contain; display: block; }
      #manlung-site-preloader .preloader-dots { display: flex; align-items: center; justify-content: center; gap: 6px; height: 12px; }
      #manlung-site-preloader .preloader-dots span { width: 5px; height: 5px; border-radius: 50%; background: #64748b; animation: manlungPreloaderDot 1s ease-in-out infinite; }
      #manlung-site-preloader .preloader-dots span:nth-child(2) { animation-delay: .14s; }
      #manlung-site-preloader .preloader-dots span:nth-child(3) { animation-delay: .28s; }
      @keyframes manlungPreloaderDot { 0%, 70%, 100% { opacity: .28; transform: translateY(0); } 35% { opacity: 1; transform: translateY(-3px); } }
      @media (prefers-color-scheme: dark) { #manlung-site-preloader { background: #050b16; } #manlung-site-preloader .preloader-dots span { background: #cbd5e1; } }
      @media (prefers-reduced-motion: reduce) { #manlung-site-preloader .preloader-dots span { animation: none; opacity: .65; } }
    `;
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.id = 'manlung-site-preloader';
    overlay.setAttribute('aria-label', 'Loading Manlung Recovery');
    overlay.innerHTML = `<div class="preloader-inner" aria-hidden="true"><img class="preloader-logo" src="/icons/icon-192.png" alt=""><div class="preloader-dots"><span></span><span></span><span></span></div></div>`;
    document.body.prepend(overlay);
    let hidden = false;
    const hide = () => { if (hidden) return; hidden = true; overlay.classList.add('is-hidden'); window.setTimeout(() => overlay.remove(), 400); };
    const minTime = window.setTimeout(() => { if (document.readyState === 'complete') hide(); }, 650);
    window.addEventListener('load', () => { window.clearTimeout(minTime); window.setTimeout(hide, 180); }, { once: true });
    window.setTimeout(hide, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPreloader, { once: true }); else installPreloader();
})();

/* Manlung Recovery — floating contact method picker and balanced header styling. */
(function () {
  'use strict';
  const WHATSAPP_URL = 'https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%20%F0%9F%91%8B%2C%20I%20came%20across%20your%20website%20and%20I%E2%80%99d%20like%20to%20get%20some%20help%20with%20my%20recovery%20request.%20Could%20you%20please%20guide%20me%20on%20what%20I%20need%20to%20do%20next%3F%20Thank%20you%21';
  const EMAIL_URL = 'mailto:manlungrecovery@outlook.com?subject=Manlung%20Recovery%20Support';
  const ICONS = { whatsapp: 'https://i.postimg.cc/Y99J1yqZ/whatsapp-whatsapp-app-logo-in-green-circle-AZU1A2SU-t-Photoroom.png', email: 'https://i.postimg.cc/zGNDn8Zm/125376099-mail-symbol-icon-red-simple-with-rounded-corners-isolated-vector-illustration-Photoroom.png', call: 'https://i.postimg.cc/wv196BJF/istockphoto-971654072-612x612-Photoroom.png' };

  function injectStyles() {
    if (document.getElementById('manlung-contact-fab-styles')) return;
    const style = document.createElement('style'); style.id = 'manlung-contact-fab-styles'; style.textContent = `
      /* Clean solid header: full width, no separator lines or decorative shapes. */
      .site-header,
      .site-header::before,
      .site-header::after {
        position: sticky !important;
        top: 0 !important;
        z-index: 1000 !important;
        background: #ffffff !important;
        color: #111827 !important;
        border: 0 !important;
        border-top: 0 !important;
        border-bottom: 0 !important;
        box-shadow: none !important;
        outline: 0 !important;
        background-image: none !important;
      }
      .site-header .container {
        width: 100% !important;
        max-width: none !important;
        min-height: 84px !important;
        margin: 0 !important;
        padding: 14px 48px !important;
        box-sizing: border-box !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 44px !important;
        flex-wrap: nowrap !important;
        border: 0 !important;
        box-shadow: none !important;
        outline: 0 !important;
        background: transparent !important;
        background-image: none !important;
      }
      .site-header .container::before,
      .site-header .container::after { content: none !important; display: none !important; }
      .site-header .brand { display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 13px !important; min-width: 0 !important; flex: 1 1 auto !important; text-align: left !important; }
      .site-header .manlung-home-logo { display: flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 48px !important; width: 48px !important; height: 48px !important; margin: 0 !important; }
      .site-header .manlung-site-logo { width: 48px !important; height: 48px !important; flex: 0 0 48px !important; object-fit: cover !important; border-radius: 10px !important; background: #ffffff !important; border: 0 !important; box-shadow: none !important; }
      .site-header .brand h1 { margin: 0 !important; color: #111111 !important; font-size: 1.35rem !important; line-height: 1.1 !important; font-weight: 800 !important; letter-spacing: -.025em !important; }
      .site-header .brand h1 i { color: #111111 !important; margin-right: 7px !important; }
      .site-header .brand span { display: block !important; margin: 4px 0 0 !important; color: #667085 !important; font-size: .74rem !important; line-height: 1.25 !important; font-weight: 500 !important; white-space: nowrap !important; }

      /* Header navigation is plain text: no triangle, pill, box, border, radius or shadow. */
      .site-header .header-actions { display: flex !important; align-items: center !important; justify-content: flex-end !important; gap: 28px !important; flex: 0 0 auto !important; flex-wrap: nowrap !important; }
      .site-header .header-actions a,
      .site-header .header-actions button,
      .site-header .header-actions .btn,
      .site-header .header-actions .btn-outline,
      .site-header .header-actions .btn-primary {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 7px !important;
        min-height: 32px !important;
        width: auto !important;
        padding: 4px 0 !important;
        margin: 0 !important;
        border: 0 !important;
        border-width: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        outline: 0 !important;
        color: #111111 !important;
        text-decoration: none !important;
        font-size: .84rem !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        transform: none !important;
        clip-path: none !important;
        -webkit-clip-path: none !important;
      }
      .site-header .header-actions a::before,
      .site-header .header-actions a::after,
      .site-header .header-actions button::before,
      .site-header .header-actions button::after { content: none !important; display: none !important; }
      .site-header .header-actions a i, .site-header .header-actions button i { color: #111111 !important; font-size: .82rem !important; margin: 0 !important; }
      .site-header .header-actions a:hover, .site-header .header-actions button:hover { background: transparent !important; border: 0 !important; box-shadow: none !important; color: #2451d6 !important; }
      .site-header .header-actions a:hover i, .site-header .header-actions button:hover i { color: #2451d6 !important; }

      /* Other navigation containers: links stay independent text rather than shaped controls. */
      nav a,
      .nav-links a,
      .mobile-nav a,
      .admin-nav a,
      .portal-nav a,
      .page-nav a,
      .top-nav a,
      .navbar a {
        background: transparent !important;
        background-image: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        outline: 0 !important;
        clip-path: none !important;
        -webkit-clip-path: none !important;
        text-decoration: none !important;
      }
      nav a::before, nav a::after,
      .nav-links a::before, .nav-links a::after,
      .mobile-nav a::before, .mobile-nav a::after,
      .admin-nav a::before, .admin-nav a::after,
      .portal-nav a::before, .portal-nav a::after,
      .page-nav a::before, .page-nav a::after,
      .top-nav a::before, .top-nav a::after,
      .navbar a::before, .navbar a::after { content: none !important; display: none !important; }

      /* Remove blue glow from every real .btn while preserving layout, colors and functionality. */
      .btn,
      .btn:hover,
      .btn:focus,
      .btn:active,
      .btn:focus-visible,
      a.btn,
      a.btn:hover,
      a.btn:focus,
      a.btn:active,
      a.btn:focus-visible,
      button.btn,
      button.btn:hover,
      button.btn:focus,
      button.btn:active,
      button.btn:focus-visible {
        box-shadow: none !important;
        text-shadow: none !important;
        outline: none !important;
        filter: none !important;
      }

      /* Dark mode: solid surface, still no navigation shapes or separator lines. */
      body.dark .site-header, body.dark .site-header::before, body.dark .site-header::after { background: #0b1424 !important; color: #e6ecf5 !important; border: 0 !important; box-shadow: none !important; outline: 0 !important; background-image: none !important; }
      body.dark .site-header .container, body.dark .site-header .container::before, body.dark .site-header .container::after { border: 0 !important; box-shadow: none !important; outline: 0 !important; }
      body.dark .site-header .brand h1 { color: #f8fafc !important; }
      body.dark .site-header .brand h1 i { color: #dbeafe !important; }
      body.dark .site-header .brand span { color: #96abc4 !important; }
      body.dark .site-header .header-actions a, body.dark .site-header .header-actions button, body.dark .site-header .header-actions .btn-primary { color: #e6ecf5 !important; }
      body.dark .site-header .header-actions a i, body.dark .site-header .header-actions button i, body.dark .site-header .header-actions .btn-primary i { color: #c7d7f2 !important; }
      body.dark .site-header .header-actions a:hover, body.dark .site-header .header-actions button:hover, body.dark .site-header .header-actions .btn-primary:hover, body.dark .site-header .header-actions a:hover i, body.dark .site-header .header-actions button:hover i, body.dark .site-header .header-actions .btn-primary:hover i { color: #ffffff !important; }

      @media (max-width: 1050px) and (min-width: 701px) { .site-header .container { padding-left: 24px !important; padding-right: 24px !important; gap: 24px !important; } .site-header .header-actions { gap: 18px !important; } .site-header .header-actions a, .site-header .header-actions button { font-size: .78rem !important; } .site-header .brand h1 { font-size: 1.2rem !important; } .site-header .brand span { font-size: .68rem !important; } }
      @media (max-width: 700px) { .site-header .container { width: 100% !important; min-height: 68px !important; padding: 10px 14px !important; gap: 9px !important; flex-wrap: wrap !important; } .site-header .brand { width: 100% !important; flex: 1 1 100% !important; gap: 10px !important; } .site-header .manlung-home-logo, .site-header .manlung-site-logo { width: 40px !important; height: 40px !important; flex-basis: 40px !important; } .site-header .brand h1 { font-size: .98rem !important; } .site-header .brand span { font-size: .6rem !important; white-space: normal !important; } .site-header .header-actions { width: 100% !important; flex: 1 1 100% !important; justify-content: flex-start !important; gap: 20px !important; overflow-x: auto !important; flex-wrap: nowrap !important; padding: 2px 0 3px !important; scrollbar-width: none !important; } .site-header .header-actions::-webkit-scrollbar { display: none !important; } .site-header .header-actions a, .site-header .header-actions button { flex: 0 0 auto !important; min-height: 32px !important; padding: 4px 0 !important; font-size: .72rem !important; } .site-header .header-actions a i, .site-header .header-actions button i { font-size: .78rem !important; } }
      @media (max-width: 420px) { .site-header .container { padding-left: 12px !important; padding-right: 12px !important; } .site-header .brand h1 { font-size: .92rem !important; } .site-header .brand span { font-size: .56rem !important; } .site-header .header-actions { gap: 16px !important; } .site-header .header-actions a, .site-header .header-actions button { font-size: .68rem !important; } }

      #callWidgetBtn.manlung-contact-trigger { width: 54px !important; min-width: 54px !important; height: 54px !important; min-height: 54px !important; padding: 0 !important; border-radius: 50% !important; justify-content: center !important; gap: 0 !important; overflow: hidden !important; }
      #callWidgetBtn.manlung-contact-trigger .manlung-floating-call-icon { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; max-width: 30px !important; max-height: 30px !important; flex: 0 0 30px !important; }
      #callWidgetBtn.manlung-contact-trigger #callWidgetLabel { display: none !important; }
      #manlungContactMenu[hidden] { display: none !important; }
      #manlungContactMenu { position: absolute; right: 3px; bottom: 62px; display: flex; flex-direction: column; align-items: center; gap: 9px; z-index: 210; }
      .manlung-contact-choice { width: 46px; height: 46px; min-width: 46px; min-height: 46px; padding: 0 !important; border: 2px solid rgba(255,255,255,.72); border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; box-shadow: 0 8px 22px rgba(0,0,0,.16); }
      .manlung-contact-choice img { width: 27px; height: 27px; object-fit: contain; }
      @media (max-width: 700px) { #callWidgetBtn.manlung-contact-trigger { width: 50px !important; min-width: 50px !important; height: 50px !important; min-height: 50px !important; } #manlungContactMenu { bottom: 58px; } }
    `; document.head.appendChild(style);
  }

  function stripButtonGlow() {
    const selectors = [
      '.btn',
      '.site-header .header-actions a',
      '.site-header .header-actions button',
      'button',
      'input[type="button"]',
      'input[type="submit"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((el) => {
      if (el.id === 'callWidgetBtn' || el.classList.contains('manlung-contact-choice')) return;
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('text-shadow');
      el.style.removeProperty('outline');
      el.style.removeProperty('filter');
    });
  }

  function init() {
    injectStyles();
    stripButtonGlow();
    const observer = new MutationObserver(stripButtonGlow);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();