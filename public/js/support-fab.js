/* Manlung Recovery — restored floating contact controls and AI bootstrap.
   The underlying WebRTC Call Admin widget remains untouched. */
(() => {
  'use strict';
  if (window.__MANLUNG_SUPPORT_FAB__) return;
  window.__MANLUNG_SUPPORT_FAB__ = true;

  function loadAI() {
    if (document.getElementById('manlungAiRoot') || document.querySelector('script[data-manlung-ai-restore]')) return;
    const s = document.createElement('script');
    s.src = '/js/manlung-ai-v2.js?v=restore-1';
    s.defer = true;
    s.dataset.manlungAiRestore = 'true';
    document.head.appendChild(s);
  }

  const ICONS = {
    call: 'https://i.postimg.cc/wv196BJF/istockphoto-971654072-612x612-Photoroom.png',
    whatsapp: 'https://i.postimg.cc/Y99J1yqZ/whatsapp-whatsapp-app-logo-in-green-circle-AZU1A2SU-t-Photoroom.png',
    email: 'https://i.postimg.cc/zGNDn8Zm/125376099-mail-symbol-icon-red-simple-with-rounded-corners-isolated-vector-illustration-Photoroom.png'
  };
  const WA = 'https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%20%F0%9F%91%8B%2C%20I%20need%20help%20with%20my%20recovery%20request.';
  const EMAIL = 'mailto:manlungrecovery@outlook.com?subject=Manlung%20Recovery%20Support';

  function css() {
    if (document.getElementById('manlung-restored-contact-styles')) return;
    const s = document.createElement('style');
    s.id = 'manlung-restored-contact-styles';
    s.textContent = `
      #callWidget { z-index:2147482000 !important; }
      #callWidgetBtn.manlung-restored-trigger {
        width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important;
        padding:0!important;border-radius:50%!important;display:flex!important;align-items:center!important;
        justify-content:center!important;overflow:hidden!important;font-size:0!important;
      }
      #callWidgetBtn.manlung-restored-trigger #callWidgetLabel { display:none!important; }
      #callWidgetBtn.manlung-restored-trigger .manlung-floating-call-icon {
        width:31px!important;height:31px!important;min-width:31px!important;min-height:31px!important;
        max-width:31px!important;max-height:31px!important;object-fit:contain!important;margin:0!important;
      }
      #manlungRestoredContactMenu {
        position:absolute!important;right:6px!important;bottom:67px!important;z-index:2147482001!important;
        display:none;flex-direction:column;align-items:center;gap:10px!important;
      }
      #manlungRestoredContactMenu.open { display:flex!important; }
      .manlung-restored-contact-choice {
        width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important;
        padding:0!important;border:2px solid rgba(255,255,255,.9)!important;border-radius:50%!important;
        background:#fff!important;box-shadow:0 8px 22px rgba(0,0,0,.28)!important;display:flex!important;
        align-items:center!important;justify-content:center!important;cursor:pointer!important;
      }
      .manlung-restored-contact-choice img { width:29px!important;height:29px!important;object-fit:contain!important;display:block!important; }
      @media(max-width:600px){
        #callWidgetBtn.manlung-restored-trigger{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important}
        #callWidgetBtn.manlung-restored-trigger .manlung-floating-call-icon{width:29px!important;height:29px!important;min-width:29px!important;min-height:29px!important;max-width:29px!important;max-height:29px!important}
        #manlungRestoredContactMenu{bottom:61px!important;right:1px!important}
        .manlung-restored-contact-choice{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important}
        .manlung-restored-contact-choice img{width:27px!important;height:27px!important}
      }
    `;
    document.head.appendChild(s);
  }

  function addMenu(button) {
    if (!button || document.getElementById('manlungRestoredContactMenu')) return;
    css();
    button.classList.add('manlung-restored-trigger');

    const menu = document.createElement('div');
    menu.id = 'manlungRestoredContactMenu';
    menu.setAttribute('aria-label','Contact Manlung Recovery');
    menu.innerHTML = `
      <a class="manlung-restored-contact-choice" href="${WA}" target="_blank" rel="noopener" aria-label="WhatsApp">
        <img src="${ICONS.whatsapp}" alt="WhatsApp">
      </a>
      <a class="manlung-restored-contact-choice" href="${EMAIL}" aria-label="Email">
        <img src="${ICONS.email}" alt="Email">
      </a>
      <button class="manlung-restored-contact-choice" type="button" aria-label="Call Admin">
        <img src="${ICONS.call}" alt="Call Admin">
      </button>`;
    button.parentElement.appendChild(menu);

    const callChoice = menu.querySelector('button');
    let allowOriginal = false;
    button.addEventListener('click', event => {
      if (allowOriginal) { allowOriginal = false; return; }
      event.preventDefault();
      event.stopImmediatePropagation();
      menu.classList.toggle('open');
    }, true);
    callChoice.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      menu.classList.remove('open');
      allowOriginal = true;
      button.click();
    });
    document.addEventListener('click', event => {
      if (!menu.contains(event.target) && event.target !== button) menu.classList.remove('open');
    });
  }

  function waitForCallButton() {
    css();
    loadAI();
    const existing = document.getElementById('callWidgetBtn');
    if (existing) return addMenu(existing);
    const observer = new MutationObserver(() => {
      const button = document.getElementById('callWidgetBtn');
      if (button) { observer.disconnect(); addMenu(button); }
    });
    observer.observe(document.body || document.documentElement, {childList:true,subtree:true});
    setTimeout(() => {
      const button = document.getElementById('callWidgetBtn');
      if (button) addMenu(button);
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForCallButton, {once:true});
  else waitForCallButton();
})();
