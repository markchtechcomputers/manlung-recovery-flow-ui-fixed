(() => {
  const STORAGE_KEY = 'theme';
  const LIGHT = 'light';
  const DARK = 'dark';
  const CLIPS = [
    'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/Futuristic%20HUD%20Interface%20Sound%20Design%20-%20Binary%20Code%203%20Example%20(1).mp4',
    'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/YTDown.com_YouTube_cyber-security-stock-footage-free-video-_Media_Z4F3AXvrLKo_001_1080p.mp4',
    'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/WhatsApp%20Video%202026-08-18%20at%203.06.03%20PM.mp4'
  ];

  function readTheme() {
    try { return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT; }
    catch (_) { return LIGHT; }
  }

  function writeTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  function removeLegacyNavigationColours() {
    ['manlung-colour-nav','manlung-home-mobile-nav','manlung-header-style','manlung-site-logo-style']
      .forEach(id => document.getElementById(id)?.remove());
  }

  function convertLegacyButtons() {
    document.querySelectorAll('[onclick="toggleDarkMode()"], .theme-toggle').forEach(button => {
      button.dataset.themeToggle = 'true';
      button.removeAttribute('onclick');
    });
  }

  function themeIconSvg(isDark) {
    if (isDark) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }

  function normalizeThemeButtons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('[data-theme-toggle="true"]').forEach(button => {
      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-pressed', String(isDark));

      // Use an inline SVG so the icon never depends on Font Awesome or another icon font.
      button.innerHTML = themeIconSvg(isDark);
      button.dataset.manlungIconOnly = 'true';
    });
  }

  function setTheme(theme, persist = true) {
    const next = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.classList.toggle('dark', next === DARK);
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (document.body) document.body.classList.toggle('dark', next === DARK);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === DARK ? '#050b16' : '#ffffff');
    normalizeThemeButtons();
    if (persist) writeTheme(next);
    return next;
  }

  function bindThemeButtons() {
    document.querySelectorAll('[data-theme-toggle="true"]').forEach(button => {
      if (button.dataset.themeBound === 'true') return;
      button.dataset.themeBound = 'true';
      button.addEventListener('click', () => {
        setTheme(readTheme() === DARK ? LIGHT : DARK, true);
      });
    });
  }

  function createThemeButton() {
    if (document.querySelector('[data-theme-toggle="true"]')) return;
    const actions = document.querySelector('.home-header-container .header-actions') || document.querySelector('.site-header .header-actions');
    if (!actions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'manlung-theme-toggle';
    button.dataset.themeToggle = 'true';
    actions.insertBefore(button, actions.firstChild);
    bindThemeButtons();
  }

  function installHeaderPolish() {
    if (document.getElementById('manlung-header-icon-polish')) return;
    const style = document.createElement('style');
    style.id = 'manlung-header-icon-polish';
    style.textContent = `
      .site-header .header-actions a,
      .site-header .header-actions button,
      .site-header .header-actions .btn {
        box-shadow:none!important; outline:none!important; border:0!important;
        border-radius:0!important; background:transparent!important; background-image:none!important;
        text-shadow:none!important; filter:none!important; transform:none!important;
        font-weight:800!important;
      }
      .site-header .header-actions button[data-theme-toggle="true"] {
        width:34px!important; height:34px!important; min-width:34px!important;
        padding:0!important; display:inline-flex!important; align-items:center!important;
        justify-content:center!important; background:transparent!important; color:inherit!important;
        overflow:visible!important;
      }
      .site-header .header-actions button[data-theme-toggle="true"]::before,
      .site-header .header-actions button[data-theme-toggle="true"]::after,
      .site-header .header-actions .theme-toggle::before,
      .site-header .header-actions .theme-toggle::after { content:none!important; display:none!important; }
      .site-header .header-actions button[data-theme-toggle="true"] span { display:none!important; }
      .site-header .header-actions button[data-theme-toggle="true"] svg {
        display:block!important; width:22px!important; height:22px!important;
        min-width:22px!important; min-height:22px!important; margin:0!important; padding:0!important;
        fill:none!important; stroke:currentColor!important; stroke-width:2!important;
        stroke-linecap:round!important; stroke-linejoin:round!important;
        color:inherit!important; background:transparent!important; border:0!important;
        box-shadow:none!important; opacity:1!important; visibility:visible!important;
      }
      @media(max-width:700px) {
        .site-header .header-actions {
          display:flex!important; width:100%!important; min-width:0!important;
          align-items:center!important; justify-content:flex-start!important;
          gap:20px!important; flex-wrap:nowrap!important; overflow-x:auto!important;
          overflow-y:hidden!important; padding:4px 0 6px!important; margin:0!important;
          scrollbar-width:none!important; -webkit-overflow-scrolling:touch!important;
        }
        .site-header .header-actions::-webkit-scrollbar { display:none!important; }
        .site-header .header-actions > * {
          flex:0 0 auto!important; min-width:max-content!important; min-height:34px!important;
          white-space:nowrap!important; margin:0!important;
        }
      }
      @media(max-width:480px) {
        .site-header .header-actions { gap:17px!important; }
        .site-header .header-actions a,
        .site-header .header-actions button,
        .site-header .header-actions .btn { font-size:.68rem!important; }
        .site-header .header-actions button[data-theme-toggle="true"] svg { width:21px!important; height:21px!important; }
      }
      html.dark .site-header .header-actions a,
      html.dark .site-header .header-actions button,
      html.dark .site-header .header-actions .btn,
      body.dark .site-header .header-actions a,
      body.dark .site-header .header-actions button,
      body.dark .site-header .header-actions .btn { color:#fff!important; background:transparent!important; }
    `;
    document.head.appendChild(style);
  }

  function installCallIconFix() {
    if (document.getElementById('manlung-floating-call-icon-fix')) return;
    const style = document.createElement('style');
    style.id = 'manlung-floating-call-icon-fix';
    style.textContent = `
      #callWidgetBtn img.manlung-floating-call-icon {
        width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;
        max-width:20px!important;max-height:20px!important;object-fit:contain!important;
        margin:0!important;padding:0!important;display:inline-block!important;
      }
      @media(max-width:600px){#callWidgetBtn img.manlung-floating-call-icon{width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;max-width:28px!important;max-height:28px!important}}
    `;
    document.head.appendChild(style);
  }

  function loadScriptOnce(src, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute('data-' + marker, 'true');
    document.head.appendChild(script);
  }

  function loadAdminCallIcons() {
    if (location.pathname.startsWith('/admin/')) loadScriptOnce('/js/admin-call-icons.js', 'manlungAdminCallIcons');
  }

  function loadContactFab() {
    loadScriptOnce('/js/contact-fab.js', 'manlungContactFab');
  }

  function loadManlungAI() {
    loadScriptOnce('/js/manlung-ai.js?v=20260915-' + Date.now(), 'manlungFunctionalAI');
  }

  function loadClientCaseChat() {
    if (location.pathname.startsWith('/client/track.html')) {
      loadScriptOnce('/js/client-case-chat.js?v=20260906c', 'manlung-client-case-chat');
    }
  }

  function installHeroVideoPlaylist() {
    const hero = document.querySelector('.hero');
    if (!hero || !CLIPS.length) return;
    const existing = hero.querySelector('.hero-video');
    if (!existing || existing.dataset.manlungPlaylist === 'true') return;

    const video = existing.cloneNode(true);
    existing.replaceWith(video);
    video.id = 'heroVideoPlaylist';
    video.dataset.manlungPlaylist = 'true';
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = false;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute('muted','');
    video.setAttribute('autoplay','');
    video.setAttribute('playsinline','');
    video.preload = 'metadata';

    let current = 0;
    const play = () => { if (!document.hidden) { const p = video.play(); if (p?.catch) p.catch(() => {}); } };
    const next = () => {
      current = (current + 1) % CLIPS.length;
      video.src = CLIPS[current];
      video.load();
      play();
    };
    video.addEventListener('ended', next);
    video.addEventListener('error', next);
    document.addEventListener('visibilitychange', play);
    video.src = CLIPS[0];
    video.load();
    play();
  }

  function isAndroidApp() {
    try {
      return Boolean(window.Capacitor?.isNativePlatform?.()) ||
        /Capacitor|ManlungRecoveryAndroid/i.test(window.navigator.userAgent);
    } catch (_) {
      return false;
    }
  }

  function installAndroidAppMode() {
    if (!isAndroidApp()) return;
    document.documentElement.classList.add('manlung-android-app');
    document.body?.classList.add('manlung-android-app');

    if (!document.getElementById('manlung-android-app-mode-style')) {
      const style = document.createElement('style');
      style.id = 'manlung-android-app-mode-style';
      style.textContent = `
        /* Keep the live site inside the visible Android app viewport. */
        html.manlung-android-app,
        body.manlung-android-app {
          width: 100%;
          min-width: 0 !important;
          max-width: 100%;
          overflow-x: clip !important;
          overscroll-behavior-x: none;
        }
        html.manlung-android-app body.manlung-android-app {
          box-sizing: border-box;
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        html.manlung-android-app body.manlung-android-app *,
        html.manlung-android-app body.manlung-android-app *::before,
        html.manlung-android-app body.manlung-android-app *::after {
          box-sizing: border-box;
        }
        html.manlung-android-app body.manlung-android-app img,
        html.manlung-android-app body.manlung-android-app video,
        html.manlung-android-app body.manlung-android-app iframe,
        html.manlung-android-app body.manlung-android-app canvas,
        html.manlung-android-app body.manlung-android-app table {
          max-width: 100%;
        }
        html.manlung-android-app body.manlung-android-app .container,
        html.manlung-android-app body.manlung-android-app main,
        html.manlung-android-app body.manlung-android-app section,
        html.manlung-android-app body.manlung-android-app .card,
        html.manlung-android-app body.manlung-android-app .panel {
          min-width: 0;
        }
        html.manlung-android-app body.manlung-android-app input,
        html.manlung-android-app body.manlung-android-app select,
        html.manlung-android-app body.manlung-android-app textarea,
        html.manlung-android-app body.manlung-android-app button {
          max-width: 100%;
        }
        html.manlung-android-app body.manlung-android-app .site-header,
        html.manlung-android-app body.manlung-android-app .mobile-friendly-header {
          padding-top: env(safe-area-inset-top, 0px);
        }
        @media (max-width: 700px) {
          html.manlung-android-app body.manlung-android-app .container,
          html.manlung-android-app body.manlung-android-app .page-container,
          html.manlung-android-app body.manlung-android-app .content-container {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          html.manlung-android-app body.manlung-android-app .header-actions {
            max-width: 100%;
            min-width: 0;
          }
        }
        html.manlung-android-app body.manlung-android-app .site-footer,
        html.manlung-android-app body.manlung-android-app footer.site-footer,
        html.manlung-android-app body.manlung-android-app .manlung-footer,
        html.manlung-android-app body.manlung-android-app [data-desktop-only],
        html.manlung-android-app body.manlung-android-app .desktop-only,
        html.manlung-android-app body.manlung-android-app .desktop-only-section,
        html.manlung-android-app body.manlung-android-app .website-only,
        html.manlung-android-app body.manlung-android-app .pwa-install-prompt,
        html.manlung-android-app body.manlung-android-app #manlung-pwa-banner {
          display: none !important;
        }
        html.manlung-android-app body.manlung-android-app a[href*="download-app.html"],
        html.manlung-android-app body.manlung-android-app a[href*="ManlungRecovery.apk"],
        html.manlung-android-app body.manlung-android-app a[href*="/releases/download/android-latest/"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const removeAppOnlyPromos = () => {
      document.querySelectorAll(
        '#manlung-pwa-banner, [data-pwa-install], .pwa-install-prompt, .apk-download-prompt'
      ).forEach(node => node.remove());
      document.querySelectorAll(
        'a[href*="download-app.html"], a[href*="ManlungRecovery.apk"], a[href*="/releases/download/android-latest/"]'
      ).forEach(link => {
        link.setAttribute('aria-hidden', 'true');
        link.setAttribute('tabindex', '-1');
      });
    };
    removeAppOnlyPromos();
    if (!window.__manlungAppModeObserver && document.body) {
      window.__manlungAppModeObserver = new MutationObserver(removeAppOnlyPromos);
      window.__manlungAppModeObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function installGlobalLanguageSelector() {
    if (document.getElementById('manlungLanguageControl')) return;
    const actions = document.querySelector('.site-header .header-actions');
    if (!actions) return;

    const control = document.createElement('div');
    control.id = 'manlungLanguageControl';
    control.className = 'manlung-language-control';
    control.innerHTML = `
      <button type="button" class="manlung-language-button" id="manlungLanguageButton" aria-label="Choose website language" title="Choose website language" aria-haspopup="dialog" aria-expanded="false">
        <img src="https://i.postimg.cc/xCBk1RL2/icons8-language-94.png" alt="" aria-hidden="true">
        <span class="manlung-language-short-label">Language</span>
      </button>
      <div class="manlung-language-popover" id="manlungLanguagePopover" role="dialog" aria-label="Website language" hidden>
        <label for="manlungLanguageSearch">Choose your language</label>
        <input id="manlungLanguageSearch" type="search" placeholder="Search languages…" autocomplete="off">
        <select id="manlungLanguageSelect" size="8" aria-label="Available languages">
          <option value="">Loading languages…</option>
        </select>
        <p id="manlungLanguageStatus" aria-live="polite">Translations are provided automatically.</p>
        <button type="button" id="manlungLanguageReset">Show original language</button>
      </div>
    `;

    const themeButton = actions.querySelector('[data-theme-toggle="true"]');
    if (themeButton?.parentElement === actions) themeButton.insertAdjacentElement('afterend', control);
    else actions.insertBefore(control, actions.firstChild);

    const style = document.createElement('style');
    style.id = 'manlung-language-selector-style';
    style.textContent = `
      .manlung-language-control{position:relative;display:inline-flex;align-items:center;flex:0 0 auto!important;min-width:0!important}
      .manlung-language-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-width:34px!important;min-height:34px!important;padding:4px 6px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:inherit!important;cursor:pointer!important;font:inherit!important;font-size:.7rem!important;font-weight:800!important;white-space:nowrap!important}
      .manlung-language-button img{display:block!important;width:25px!important;height:25px!important;object-fit:contain!important;background:transparent!important}
      .manlung-language-button:hover,.manlung-language-button:focus-visible{background:rgba(100,116,139,.13)!important;outline:2px solid rgba(59,130,246,.35)!important;outline-offset:2px}
      .manlung-language-popover{position:absolute;z-index:10050;top:calc(100% + 10px);right:0;width:min(310px,calc(100vw - 28px));padding:14px;border:1px solid #cbd5e1;border-radius:15px;background:#fff;color:#0f172a;box-shadow:0 18px 55px rgba(2,6,23,.24);text-align:left;white-space:normal}
      .manlung-language-popover[hidden]{display:none!important}
      .manlung-language-popover label{display:block;margin:0 0 8px;font-size:.86rem;font-weight:850}
      .manlung-language-popover input,.manlung-language-popover select{display:block;width:100%;max-width:100%;min-height:40px;margin:0 0 9px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-size:.82rem}
      .manlung-language-popover select{height:220px;padding:4px}
      .manlung-language-popover option{padding:6px}
      .manlung-language-popover p{margin:7px 0;color:#475569;font-size:.72rem;line-height:1.5}
      .manlung-language-popover #manlungLanguageReset{width:100%;min-height:38px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#0f172a;font:inherit;font-size:.78rem;font-weight:750;cursor:pointer}
      .goog-te-banner-frame,.goog-te-banner,.skiptranslate > iframe,.goog-te-balloon-frame{display:none!important;visibility:hidden!important}html{top:0!important}body{top:0!important}\n      body > .skiptranslate{display:none!important;height:0!important;overflow:hidden!important}\n      .goog-logo-link,.goog-te-gadget span{display:none!important}\n      .goog-te-gadget{font-size:0!important}\n      #goog-gt-tt,.goog-te-balloon-frame,.goog-text-highlight{display:none!important;background:transparent!important;box-shadow:none!important}
      @media(max-width:700px){.manlung-language-button{padding:3px!important}.manlung-language-button img{width:27px!important;height:27px!important}.manlung-language-short-label{display:none}.manlung-language-popover{position:fixed;top:75px;right:12px;width:min(330px,calc(100vw - 24px));max-height:calc(100dvh - 95px);overflow:auto}}
      html.dark .manlung-language-popover,body.dark .manlung-language-popover{background:#111c2e;color:#f8fafc;border-color:#334155}
      html.dark .manlung-language-popover input,html.dark .manlung-language-popover select,body.dark .manlung-language-popover input,body.dark .manlung-language-popover select{background:#0b1220;color:#f8fafc;border-color:#475569}
      html.dark .manlung-language-popover p,body.dark .manlung-language-popover p{color:#cbd5e1}
      html.dark .manlung-language-popover #manlungLanguageReset,body.dark .manlung-language-popover #manlungLanguageReset{background:#1e293b;color:#f8fafc;border-color:#475569}
    `;
    document.head.appendChild(style);

    const search = control.querySelector('#manlungLanguageSearch');
    const select = control.querySelector('#manlungLanguageSelect');
    const popover = control.querySelector('#manlungLanguagePopover');
    const button = control.querySelector('#manlungLanguageButton');
    const status = control.querySelector('#manlungLanguageStatus');
    const reset = control.querySelector('#manlungLanguageReset');
    const allOptions = [
      ['af','Afrikaans'],['sq','Albanian'],['am','Amharic'],['ar','Arabic'],['hy','Armenian'],['az','Azerbaijani'],['eu','Basque'],['be','Belarusian'],['bn','Bengali'],['bs','Bosnian'],['bg','Bulgarian'],['my','Burmese'],['ca','Catalan'],['ceb','Cebuano'],['zh-CN','Chinese (Simplified)'],['zh-TW','Chinese (Traditional)'],['co','Corsican'],['hr','Croatian'],['cs','Czech'],['da','Danish'],['nl','Dutch'],['en','English'],['eo','Esperanto'],['et','Estonian'],['tl','Filipino'],['fi','Finnish'],['fr','French'],['fy','Frisian'],['gl','Galician'],['ka','Georgian'],['de','German'],['el','Greek'],['gu','Gujarati'],['ht','Haitian Creole'],['ha','Hausa'],['haw','Hawaiian'],['he','Hebrew'],['hi','Hindi'],['hmn','Hmong'],['hu','Hungarian'],['is','Icelandic'],['ig','Igbo'],['id','Indonesian'],['ga','Irish'],['it','Italian'],['ja','Japanese'],['jw','Javanese'],['kn','Kannada'],['kk','Kazakh'],['km','Khmer'],['rw','Kinyarwanda'],['ko','Korean'],['ku','Kurdish'],['ky','Kyrgyz'],['lo','Lao'],['la','Latin'],['lv','Latvian'],['lt','Lithuanian'],['lb','Luxembourgish'],['mk','Macedonian'],['mg','Malagasy'],['ms','Malay'],['ml','Malayalam'],['mt','Maltese'],['mi','Maori'],['mr','Marathi'],['mn','Mongolian'],['ne','Nepali'],['no','Norwegian'],['ny','Nyanja (Chichewa)'],['or','Odia (Oriya)'],['ps','Pashto'],['fa','Persian'],['pl','Polish'],['pt','Portuguese'],['pa','Punjabi'],['ro','Romanian'],['ru','Russian'],['sm','Samoan'],['gd','Scots Gaelic'],['sr','Serbian'],['st','Sesotho'],['sn','Shona'],['sd','Sindhi'],['si','Sinhala'],['sk','Slovak'],['sl','Slovenian'],['so','Somali'],['es','Spanish'],['su','Sundanese'],['sw','Swahili'],['sv','Swedish'],['tg','Tajik'],['ta','Tamil'],['tt','Tatar'],['te','Telugu'],['th','Thai'],['tr','Turkish'],['tk','Turkmen'],['uk','Ukrainian'],['ur','Urdu'],['ug','Uyghur'],['uz','Uzbek'],['vi','Vietnamese'],['cy','Welsh'],['xh','Xhosa'],['yi','Yiddish'],['yo','Yoruba'],['zu','Zulu']
    ].map(([value,label]) => ({value,label}));
    let widgetReady = false;
    const googleSelect = () => document.querySelector('.goog-te-combo');
    const currentLanguage = () => {
      try {
        const saved = localStorage.getItem('manlung-language');
        if (saved) return saved;
      } catch (_) {}
      const match = document.cookie.match(/(?:^|;\\s*)googtrans=([^;]+)/);
      return match ? decodeURIComponent(match[1]).split('/').pop() : '';
    };
    const populate = () => {
      const activeCode = currentLanguage();
      const query = search.value.trim().toLocaleLowerCase();
      const visibleOptions = allOptions.filter(option => option.label.toLocaleLowerCase().includes(query) || option.value.toLocaleLowerCase().includes(query));
      select.innerHTML = '';
      const original = document.createElement('option');
      original.value = '';
      original.textContent = 'English (original)';
      original.selected = !activeCode || activeCode === 'en';
      select.appendChild(original);
      visibleOptions.forEach(option => {
        const item = document.createElement('option');
        item.value = option.value;
        item.textContent = option.label;
        item.selected = option.value === activeCode;
        select.appendChild(item);
      });
      widgetReady = Boolean(googleSelect());
      status.textContent = widgetReady
        ? allOptions.length + ' languages available. Some wording may vary because translations are automatic.'
        : 'Languages are ready. Translation service is connecting; your choice will be saved.';
      return true;
    };

    const openPopover = () => {
      popover.hidden = false;
      button.setAttribute('aria-expanded','true');
      populate();
      search.focus();
    };
    button.addEventListener('click', () => popover.hidden ? openPopover() : (popover.hidden = true, button.setAttribute('aria-expanded','false')));
    document.addEventListener('click', event => {
      if (!control.contains(event.target)) {
        popover.hidden = true;
        button.setAttribute('aria-expanded','false');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        popover.hidden = true;
        button.setAttribute('aria-expanded','false');
      }
    });
    search.addEventListener('input', populate);

    function setTranslationCookie(language) {
      const value = language ? '/en/' + language : '';
      const expires = language ? ';expires=' + new Date(Date.now() + 365*24*60*60*1000).toUTCString() : ';expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'googtrans=' + (value ? encodeURIComponent(value) : '') + expires + ';path=/;SameSite=Lax';
      document.cookie = 'googtrans=' + (value ? encodeURIComponent(value) : '') + expires + ';path=/;domain=' + location.hostname + ';SameSite=Lax';\n      const hostParts = location.hostname.split('.');\n      if (hostParts.length > 2) {\n        const parentDomain = '.' + hostParts.slice(-2).join('.');\n        document.cookie = 'googtrans=' + (value ? encodeURIComponent(value) : '') + expires + ';path=/;domain=' + parentDomain + ';SameSite=Lax';\n      }
    }
    select.addEventListener('change', () => {
      const language = select.value;
      if (!language || language === 'en') {
        resetTranslation();
        return;
      }
      try { localStorage.setItem('manlung-language',language); } catch (_) {}
      setTranslationCookie(language);
      const combo = googleSelect();
      if (combo && Array.from(combo.options).some(option => option.value === language)) {
        combo.value = language;
        combo.dispatchEvent(new Event('change',{bubbles:true}));
        status.textContent = 'Applying ' + (allOptions.find(option => option.value === language)?.label || language) + '…';
      } else {
        status.textContent = 'Language saved. Reloading to start translation…';
        window.setTimeout(() => location.reload(), 150);
      }
      button.setAttribute('aria-label','Website language: '+(allOptions.find(option => option.value === language)?.label || language));
    });
    function resetTranslation() {
      try { localStorage.removeItem('manlung-language'); } catch (_) {}
      setTranslationCookie('');
      location.reload();
    }
    reset.addEventListener('click', resetTranslation);

    window.googleTranslateElementInit = function() {
      if (!window.google?.translate?.TranslateElement) {
        status.textContent = 'The translation service could not initialize. Check your connection or content blocker.';
        return;
      }
      new window.google.translate.TranslateElement({pageLanguage:'en', autoDisplay:false, layout:window.google.translate.TranslateElement.InlineLayout.SIMPLE}, 'manlungGoogleTranslateElement');
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts++;
        const combo = googleSelect();
        if (combo) {
          widgetReady = true;
          const saved = currentLanguage();
          if (saved && saved !== 'en' && Array.from(combo.options).some(option => option.value === saved) && combo.value !== saved) {
            combo.value = saved;
            combo.dispatchEvent(new Event('change',{bubbles:true}));
          }
          if (!popover.hidden) populate();
          window.clearInterval(timer);
        } else if (attempts > 80) {
          status.textContent = 'Language choices are available, but the translation service did not respond. Check your connection or content blocker.';
          window.clearInterval(timer);
        }
      },250);
    };

    const hiddenWidget = document.createElement('div');
    hiddenWidget.id = 'manlungGoogleTranslateElement';
    hiddenWidget.setAttribute('aria-hidden','true');
    hiddenWidget.style.cssText = 'position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;left:-10000px!important;top:auto!important';
    document.body.appendChild(hiddenWidget);
    const translateScript = document.createElement('script');
    translateScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    translateScript.async = true;
    translateScript.onerror = () => { status.textContent = 'Translation service could not load. Check your connection or content blocker.'; };
    document.head.appendChild(translateScript);
  }

  function boot() {
    installAndroidAppMode();
    installGlobalLanguageSelector();
    removeLegacyNavigationColours();
    convertLegacyButtons();
    installHeaderPolish();
    setTheme(readTheme(), false);
    createThemeButton();
    bindThemeButtons();
    normalizeThemeButtons();
    installCallIconFix();
    loadAdminCallIcons();
    loadContactFab();
    loadManlungAI();
    loadClientCaseChat();
    installHeroVideoPlaylist();
  }

  window.setManlungTheme = theme => setTheme(theme, true);
  window.toggleDarkMode = () => setTheme(readTheme() === DARK ? LIGHT : DARK, true);
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) setTheme(readTheme(), false);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
