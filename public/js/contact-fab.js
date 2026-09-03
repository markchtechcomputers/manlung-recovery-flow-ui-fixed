/* Manlung Recovery — floating contact method picker.
   Keeps the existing Call Admin/WebRTC widget intact while adding
   WhatsApp and Email as quick contact choices. */
(function () {
  'use strict';

  const WHATSAPP_URL = 'https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%2C%20I%20need%20help.';
  const EMAIL_URL = 'mailto:manlungrecovery@outlook.com?subject=Manlung%20Recovery%20Support';

  function injectStyles() {
    if (document.getElementById('manlung-contact-fab-styles')) return;

    const style = document.createElement('style');
    style.id = 'manlung-contact-fab-styles';
    style.textContent = `
      /* Only ONE floating support circle is visible by default. */
      #callWidgetBtn.manlung-contact-trigger {
        width: 54px !important;
        min-width: 54px !important;
        height: 54px !important;
        min-height: 54px !important;
        padding: 0 !important;
        border-radius: 50% !important;
        justify-content: center !important;
        gap: 0 !important;
        overflow: hidden !important;
      }

      #callWidgetBtn.manlung-contact-trigger .manlung-floating-call-icon {
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        min-height: 30px !important;
        max-width: 30px !important;
        max-height: 30px !important;
        flex: 0 0 30px !important;
      }

      #callWidgetBtn.manlung-contact-trigger #callWidgetLabel {
        display: none !important;
      }

      /* IMPORTANT: author display rules must not override the hidden attribute. */
      #manlungContactMenu[hidden] {
        display: none !important;
      }

      #manlungContactMenu {
        position: absolute;
        right: 3px;
        bottom: 62px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 9px;
        z-index: 210;
      }

      .manlung-contact-choice {
        width: 46px;
        height: 46px;
        min-width: 46px;
        min-height: 46px;
        border: 2px solid rgba(255,255,255,.72);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff !important;
        text-decoration: none !important;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(0,0,0,.30);
        opacity: 0;
        transform: translateY(8px) scale(.72);
        transition: opacity .18s ease, transform .2s ease;
      }

      #manlungContactMenu:not([hidden]) .manlung-contact-choice {
        opacity: 1;
        transform: translateY(0) scale(1);
        animation: manlungContactPop .2s ease both;
      }

      .manlung-contact-choice:hover,
      .manlung-contact-choice:focus-visible {
        transform: translateY(-2px) scale(1.06);
        box-shadow: 0 11px 27px rgba(0,0,0,.38);
        outline: none;
      }

      .manlung-contact-choice i {
        margin: 0 !important;
        font-size: 1.05rem;
      }

      .manlung-contact-choice.call {
        background: linear-gradient(135deg,#20c77a,#128a55);
      }

      .manlung-contact-choice.whatsapp {
        background: linear-gradient(135deg,#25d366,#128c4a);
      }

      .manlung-contact-choice.email {
        background: linear-gradient(135deg,#4f8cff,#2451d6);
      }

      .manlung-contact-tooltip {
        position: absolute;
        right: 56px;
        white-space: nowrap;
        padding: .38rem .55rem;
        border-radius: 8px;
        background: #0b1428;
        border: 1px solid rgba(255,255,255,.12);
        color: #fff;
        font: 700 .72rem/1.1 'Inter',-apple-system,sans-serif;
        pointer-events: none;
        opacity: 0;
        transform: translateX(4px);
        transition: opacity .15s ease, transform .15s ease;
      }

      .manlung-contact-choice:hover .manlung-contact-tooltip,
      .manlung-contact-choice:focus-visible .manlung-contact-tooltip {
        opacity: 1;
        transform: translateX(0);
      }

      @keyframes manlungContactPop {
        from { opacity: 0; transform: translateY(8px) scale(.72); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Remove the older standalone Admin contact circle so it cannot create a second FAB. */
      .admin-contact-bottom {
        display: none !important;
      }

      @media (max-width:600px) {
        #callWidgetBtn.manlung-contact-trigger {
          width: 52px !important;
          min-width: 52px !important;
          height: 52px !important;
          min-height: 52px !important;
        }

        #manlungContactMenu {
          right: 2px;
          bottom: 60px;
          gap: 8px;
        }

        .manlung-contact-choice {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
        }

        .manlung-contact-tooltip {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createMenu(button) {
    if (document.getElementById('manlungContactMenu')) return;

    const menu = document.createElement('div');
    menu.id = 'manlungContactMenu';
    menu.hidden = true;
    menu.setAttribute('aria-label', 'Choose a contact method');
    menu.innerHTML = `
      <button type="button" class="manlung-contact-choice call" aria-label="Call Admin" title="Call Admin">
        <i class="fas fa-phone" aria-hidden="true"></i>
        <span class="manlung-contact-tooltip">Call Admin</span>
      </button>
      <a class="manlung-contact-choice whatsapp" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp">
        <i class="fab fa-whatsapp" aria-hidden="true"></i>
        <span class="manlung-contact-tooltip">WhatsApp</span>
      </a>
      <a class="manlung-contact-choice email" href="${EMAIL_URL}" aria-label="Email support" title="Email support">
        <i class="fas fa-envelope" aria-hidden="true"></i>
        <span class="manlung-contact-tooltip">Email</span>
      </a>
    `;

    button.parentElement.appendChild(menu);

    const callChoice = menu.querySelector('.call');
    callChoice.addEventListener('click', () => {
      closeMenu();
      button.dataset.manlungAllowOriginalClick = 'true';
      button.click();
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });
  }

  function openMenu() {
    const menu = document.getElementById('manlungContactMenu');
    if (!menu) return;
    menu.hidden = false;
  }

  function closeMenu() {
    const menu = document.getElementById('manlungContactMenu');
    if (menu) menu.hidden = true;
  }

  function toggleMenu() {
    const menu = document.getElementById('manlungContactMenu');
    if (!menu) return;
    menu.hidden ? openMenu() : closeMenu();
  }

  function install(button) {
    if (!button || button.dataset.manlungContactInstalled === 'true') return;
    button.dataset.manlungContactInstalled = 'true';
    button.classList.add('manlung-contact-trigger');
    button.setAttribute('aria-label', 'Choose a contact method');
    button.setAttribute('title', 'Contact Manlung Recovery');
    button.setAttribute('aria-expanded', 'false');
    createMenu(button);

    // Capture the existing Call Admin button click before call-widget.js's listener.
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('#callWidgetBtn') : null;
      if (target !== button) return;

      if (button.dataset.manlungAllowOriginalClick === 'true') {
        delete button.dataset.manlungAllowOriginalClick;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMenu();
      button.setAttribute('aria-expanded', String(!document.getElementById('manlungContactMenu')?.hidden));
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('#manlungContactMenu')) return;
      if (event.target instanceof Element && event.target.closest('#callWidgetBtn')) return;
      closeMenu();
      button.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function waitForCallWidget() {
    injectStyles();
    const existing = document.getElementById('callWidgetBtn');
    if (existing) {
      install(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const button = document.getElementById('callWidgetBtn');
      if (!button) return;
      observer.disconnect();
      install(button);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForCallWidget, { once: true });
  } else {
    waitForCallWidget();
  }
})();
