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
      /* Balanced, restrained site header */
      .site-header {
        position: sticky !important;
        top: 0 !important;
        z-index: 1000 !important;
        background: #0a1a3a !important;
        border-bottom: 1px solid rgba(255,255,255,.10) !important;
        box-shadow: 0 1px 0 rgba(255,255,255,.03), 0 8px 24px rgba(2,6,23,.12) !important;
      }
      .site-header .container {
        width: min(100% - 40px, 1280px) !important;
        max-width: 1280px !important;
        min-height: 82px !important;
        margin: 0 auto !important;
        padding: 14px 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 36px !important;
        flex-wrap: nowrap !important;
      }
      .site-header .brand {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 13px !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
        text-align: left !important;
      }
      .site-header .manlung-home-logo {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 48px !important;
        width: 48px !important;
        height: 48px !important;
        margin: 0 !important;
      }
      .site-header .manlung-site-logo {
        width: 48px !important;
        height: 48px !important;
        flex: 0 0 48px !important;
        object-fit: cover !important;
        border-radius: 11px !important;
        background: #fff !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        box-shadow: none !important;
      }
      .site-header .brand h1 {
        margin: 0 !important;
        color: #fff !important;
        font-size: 1.35rem !important;
        line-height: 1.1 !important;
        font-weight: 800 !important;
        letter-spacing: -.025em !important;
      }
      .site-header .brand h1 i {
        color: #8db7ff !important;
        margin-right: 7px !important;
      }
      .site-header .brand span {
        display: block !important;
        margin: 4px 0 0 !important;
        color: #aebdd4 !important;
        font-size: .74rem !important;
        line-height: 1.25 !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
      }
      .site-header .header-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 25px !important;
        flex: 0 0 auto !important;
        flex-wrap: nowrap !important;
      }
      .site-header .header-actions a,
      .site-header .header-actions button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 7px !important;
        min-height: 34px !important;
        width: auto !important;
        padding: 5px 0 !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: #dbe5f4 !important;
        text-decoration: none !important;
        font-size: .84rem !important;
        font-weight: 650 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        transition: color .18s ease, opacity .18s ease !important;
        transform: none !important;
      }
      .site-header .header-actions a i,
      .site-header .header-actions button i {
        color: #8fb5f5 !important;
        font-size: .82rem !important;
        margin: 0 !important;
      }
      .site-header .header-actions a:hover,
      .site-header .header-actions button:hover {
        background: transparent !important;
        border: 0 !important;
        color: #fff !important;
      }
      .site-header .header-actions a:hover i,
      .site-header .header-actions button:hover i { color: #b7d0ff !important; }
      .site-header .header-actions .btn-primary {
        color: #8db7ff !important;
        background: transparent !important;
        border: 0 !important;
      }
      .site-header .header-actions .btn-primary i { color: #8db7ff !important; }
      .site-header .header-actions .btn-primary:hover { color: #fff !important; }
      .site-header .header-actions .btn-primary:hover i { color: #b7d0ff !important; }

      /* Homepage colour overrides: remove the previous multi-colour button blocks. */
      .site-header .header-actions button[data-theme-toggle="true"],
      .site-header .header-actions a[href="/client/dashboard.html"],
      .site-header .header-actions a[href="/blog.html"],
      .site-header .header-actions a[href="/donate.html"] {
        background: transparent !important;
        border: 0 !important;
        color: #dbe5f4 !important;
        box-shadow: none !important;
      }
      .site-header .header-actions button[data-theme-toggle="true"] i,
      .site-header .header-actions a[href="/client/dashboard.html"] i,
      .site-header .header-actions a[href="/blog.html"] i,
      .site-header .header-actions a[href="/donate.html"] i { color: #8fb5f5 !important; }

      @media (max-width: 1050px) and (min-width: 701px) {
        .site-header .container { width: min(100% - 28px, 1280px) !important; gap: 22px !important; }
        .site-header .header-actions { gap: 17px !important; }
        .site-header .header-actions a, .site-header .header-actions button { font-size: .78rem !important; }
        .site-header .brand h1 { font-size: 1.2rem !important; }
        .site-header .brand span { font-size: .68rem !important; }
      }

      @media (max-width: 700px) {
        .site-header .container {
          width: 100% !important;
          min-height: 68px !important;
          padding: 10px 14px !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }
        .site-header .brand {
          width: 100% !important;
          flex: 1 1 100% !important;
          gap: 10px !important;
          justify-content: flex-start !important;
        }
        .site-header .manlung-home-logo,
        .site-header .manlung-site-logo {
          width: 40px !important;
          height: 40px !important;
          flex-basis: 40px !important;
        }
        .site-header .brand h1 { font-size: .98rem !important; }
        .site-header .brand span { font-size: .6rem !important; white-space: normal !important; }
        .site-header .header-actions {
          width: 100% !important;
          flex: 1 1 100% !important;
          justify-content: flex-start !important;
          gap: 17px !important;
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
          padding: 2px 0 3px !important;
          scrollbar-width: none !important;
        }
        .site-header .header-actions::-webkit-scrollbar { display: none !important; }
        .site-header .header-actions a,
        .site-header .header-actions button {
          flex: 0 0 auto !important;
          min-height: 32px !important;
          padding: 4px 0 !important;
          font-size: .72rem !important;
        }
        .site-header .header-actions a i,
        .site-header .header-actions button i { font-size: .78rem !important; }
        .site-header .header-actions .btn-primary { color: #8db7ff !important; }
      }

      @media (max-width: 420px) {
        .site-header .container { padding-left: 12px !important; padding-right: 12px !important; }
        .site-header .brand h1 { font-size: .92rem !important; }
        .site-header .brand span { font-size: .56rem !important; }
        .site-header .header-actions { gap: 14px !important; }
        .site-header .header-actions a, .site-header .header-actions button { font-size: .68rem !important; }
      }

      /* Keep the existing contact widget behavior intact. */
      #callWidgetBtn.manlung-contact-trigger { width: 54px !important; min-width: 54px !important; height: 54px !important; min-height: 54px !important; padding: 0 !important; border-radius: 50% !important; justify-content: center !important; gap: 0 !important; overflow: hidden !important; }
      #callWidgetBtn.manlung-contact-trigger .manlung-floating-call-icon { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; max-width: 30px !important; max-height: 30px !important; flex: 0 0 30px !important; }
      #callWidgetBtn.manlung-contact-trigger #callWidgetLabel { display: none !important; }
      #manlungContactMenu[hidden] { display: none !important; }
      #manlungContactMenu { position: absolute; right: 3px; bottom: 62px; display: flex; flex-direction: column; align-items: center; gap: 9px; z-index: 210; }
      .manlung-contact-choice { width: 46px; height: 46px; min-width: 46px; min-height: 46px; padding: 0 !important; border: 2px solid rgba(255,255,255,.72); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff !important; text-decoration: none !important; cursor: pointer; box-shadow: 0 8px 22px rgba(0,0,0,.30); opacity: 0; transform: translateY(8px) scale(.72); transition: opacity .18s ease, transform .2s ease; overflow: hidden !important; }
      #manlungContactMenu:not([hidden]) .manlung-contact-choice { opacity: 1; transform: translateY(0) scale(1); animation: manlungContactPop .2s ease both; }
      .manlung-contact-choice:hover, .manlung-contact-choice:focus-visible { transform: translateY(-2px) scale(1.06); box-shadow: 0 11px 27px rgba(0,0,0,.38); outline: none; }
      .manlung-contact-choice .manlung-contact-icon { display: block !important; width: 27px !important; height: 27px !important; max-width: 27px !important; max-height: 27px !important; min-width: 27px !important; min-height: 27px !important; object-fit: contain !important; object-position: center !important; border-radius: 50%; flex: 0 0 27px !important; }
      .manlung-contact-choice.call { background: linear-gradient(135deg,#20c77a,#128a55); }
      .manlung-contact-choice.whatsapp { background: linear-gradient(135deg,#25d366,#128c4a); }
      .manlung-contact-choice.email { background: linear-gradient(135deg,#4f8cff,#2451d6); }
      .manlung-contact-tooltip { position: absolute; right: 56px; white-space: nowrap; padding: .38rem .55rem; border-radius: 8px; background: #0b1428; border: 1px solid rgba(255,255,255,.12); color: #fff; font: 700 .72rem/1.1 'Inter',-apple-system,sans-serif; pointer-events: none; opacity: 0; transform: translateX(4px); transition: opacity .15s ease, transform .15s ease; }
      .manlung-contact-choice:hover .manlung-contact-tooltip, .manlung-contact-choice:focus-visible .manlung-contact-tooltip { opacity: 1; transform: translateX(0); }
      @keyframes manlungContactPop { from { opacity: 0; transform: translateY(8px) scale(.72); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .admin-contact-bottom { display: none !important; }
      @media (max-width:600px) { #callWidgetBtn.manlung-contact-trigger { width: 52px !important; min-width: 52px !important; height: 52px !important; min-height: 52px !important; } #manlungContactMenu { right: 2px; bottom: 60px; gap: 8px; } .manlung-contact-choice { width: 44px; height: 44px; min-width: 44px; min-height: 44px; } .manlung-contact-choice .manlung-contact-icon { width: 25px !important; height: 25px !important; max-width: 25px !important; max-height: 25px !important; min-width: 25px !important; min-height: 25px !important; flex-basis: 25px !important; } .manlung-contact-tooltip { display: none; } }
    `; document.head.appendChild(style);
  }
  function iconMarkup(type, alt) { return `<img class="manlung-contact-icon" src="${ICONS[type]}" alt="${alt}" width="27" height="27" loading="eager" decoding="async">`; }
  function createMenu(button) {
    if (document.getElementById('manlungContactMenu')) return;
    const menu = document.createElement('div'); menu.id = 'manlungContactMenu'; menu.hidden = true; menu.setAttribute('aria-label', 'Choose a contact method');
    menu.innerHTML = `<button type="button" class="manlung-contact-choice call" aria-label="Call Admin" title="Call Admin">${iconMarkup('call', 'Call')}<span class="manlung-contact-tooltip">Call Admin</span></button><a class="manlung-contact-choice whatsapp" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp">${iconMarkup('whatsapp', 'WhatsApp')}<span class="manlung-contact-tooltip">WhatsApp</span></a><a class="manlung-contact-choice email" href="${EMAIL_URL}" aria-label="Email support" title="Email support">${iconMarkup('email', 'Email')}<span class="manlung-contact-tooltip">Email</span></a>`;
    button.parentElement.appendChild(menu);
    const callChoice = menu.querySelector('.call');
    callChoice.addEventListener('click', () => { closeMenu(); button.dataset.manlungAllowOriginalClick = 'true'; button.click(); });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  }
  function openMenu() { const menu = document.getElementById('manlungContactMenu'); if (menu) menu.hidden = false; }
  function closeMenu() { const menu = document.getElementById('manlungContactMenu'); if (menu) menu.hidden = true; }
  function toggleMenu() { const menu = document.getElementById('manlungContactMenu'); if (!menu) return; menu.hidden ? openMenu() : closeMenu(); }
  function install(button) {
    if (!button || button.dataset.manlungContactInstalled === 'true') return;
    button.dataset.manlungContactInstalled = 'true'; button.classList.add('manlung-contact-trigger'); button.setAttribute('aria-label', 'Choose a contact method'); button.setAttribute('title', 'Contact Manlung Recovery'); button.setAttribute('aria-expanded', 'false'); createMenu(button);
    document.addEventListener('click', (event) => { const target = event.target instanceof Element ? event.target.closest('#callWidgetBtn') : null; if (target !== button) return; if (button.dataset.manlungAllowOriginalClick === 'true') { delete button.dataset.manlungAllowOriginalClick; return; } event.preventDefault(); event.stopImmediatePropagation(); toggleMenu(); button.setAttribute('aria-expanded', String(!document.getElementById('manlungContactMenu')?.hidden)); }, true);
    document.addEventListener('click', (event) => { if (event.target instanceof Element && event.target.closest('#manlungContactMenu')) return; if (event.target instanceof Element && event.target.closest('#callWidgetBtn')) return; closeMenu(); button.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeMenu(); button.setAttribute('aria-expanded', 'false'); } });
  }
  function waitForCallWidget() {
    injectStyles(); const existing = document.getElementById('callWidgetBtn');
    if (existing) { install(existing); return; }
    const observer = new MutationObserver(() => { const button = document.getElementById('callWidgetBtn'); if (!button) return; observer.disconnect(); install(button); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForCallWidget, { once: true }); else waitForCallWidget();
})();
