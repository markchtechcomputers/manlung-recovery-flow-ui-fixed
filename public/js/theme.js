(() => {
  const STORAGE_KEY = 'theme';
  const LIGHT = 'light';
  const DARK = 'dark';
  const CLIP_1 = 'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/Futuristic%20HUD%20Interface%20Sound%20Design%20-%20Binary%20Code%203%20Example%20(1).mp4';
  if (!document.querySelector('link[data-manlung-hero-preload]')) {
    const preload = document.createElement('link'); preload.rel = 'preload'; preload.as = 'video'; preload.href = CLIP_1; preload.setAttribute('data-manlung-hero-preload','true'); document.head.appendChild(preload);
  }
  function installHeroBaseStyle(){if(document.getElementById('manlung-hero-video-final-style'))return;const style=document.createElement('style');style.id='manlung-hero-video-final-style';style.textContent=`
    .hero{background:#020617!important}.hero::before{background:#020617!important}.hero-video{display:block!important;visibility:visible!important;background:#020617!important;opacity:.78!important;filter:saturate(1.05) contrast(1.03) brightness(.78)!important}.hero-overlay{background:linear-gradient(135deg,rgba(2,6,23,.28),rgba(2,6,23,.58)),linear-gradient(180deg,rgba(2,6,23,.08),rgba(2,6,23,.32))!important}.hero-content{text-shadow:0 2px 18px rgba(0,0,0,.8)}@media(max-width:600px){.hero-video{display:block!important;visibility:visible!important;width:100%!important;height:100%!important;opacity:.78!important}}@media(prefers-reduced-motion:reduce){.hero-video{display:block!important;visibility:visible!important}}
  `;document.head.appendChild(style)}
  function installHeaderPolish(){if(document.getElementById('manlung-header-icon-polish'))return;const style=document.createElement('style');style.id='manlung-header-icon-polish';style.textContent=`
    /* Header navigation: bold, plain, black/white only. */
    .site-header .header-actions a,
    .site-header .header-actions button,
    .site-header .header-actions .btn{
      box-shadow:none!important;
      outline:none!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      background-image:none!important;
      color:#000!important;
      font-weight:800!important;
      text-shadow:none!important;
      filter:none!important;
      transform:none!important;
    }
    .site-header .header-actions a:hover,
    .site-header .header-actions a:focus,
    .site-header .header-actions a:focus-visible,
    .site-header .header-actions a:active,
    .site-header .header-actions button:hover,
    .site-header .header-actions button:focus,
    .site-header .header-actions button:focus-visible,
    .site-header .header-actions button:active,
    .site-header .header-actions .btn:hover,
    .site-header .header-actions .btn:focus,
    .site-header .header-actions .btn:focus-visible,
    .site-header .header-actions .btn:active{
      color:#000!important;
      background:transparent!important;
      border:0!important;
      border-radius:0!important;
      box-shadow:none!important;
      outline:none!important;
      text-shadow:none!important;
      filter:none!important;
      transform:none!important;
    }
    .site-header .header-actions a i,
    .site-header .header-actions button i,
    .site-header .header-actions .btn i{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      width:1.05em!important;
      height:1.05em!important;
      min-width:1.05em!important;
      margin:0!important;
      padding:0!important;
      font-size:1em!important;
      line-height:1!important;
      flex:0 0 1.05em!important;
      vertical-align:middle!important;
      color:inherit!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
      transform:none!important;
    }
    .site-header .header-actions a:hover i,
    .site-header .header-actions button:hover i,
    .site-header .header-actions .btn:hover i{transform:none!important;color:inherit!important}
    .site-header .header-actions button[data-theme-toggle="true"]{
      border-radius:0!important;
      width:auto!important;
      height:auto!important;
      min-width:0!important;
      min-height:32px!important;
      padding:4px 0!important;
      position:static!important;
      font-size:.84rem!important;
      font-weight:800!important;
      flex-direction:row!important;
      color:#000!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
    }
    .site-header .header-actions button[data-theme-toggle="true"]::before,
    .site-header .header-actions button[data-theme-toggle="true"]::after{content:none!important;display:none!important}
    /* Mobile: keep the five requested actions visible in one clean horizontal row. */
    @media(max-width:700px){
      .site-header .header-actions{
        display:flex!important;
        width:100%!important;
        flex:1 1 100%!important;
        min-width:0!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:20px!important;
        flex-wrap:nowrap!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        padding:4px 0 6px!important;
        margin:0!important;
        scrollbar-width:none!important;
        -webkit-overflow-scrolling:touch!important;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
      }
      .site-header .header-actions::-webkit-scrollbar{display:none!important}
      .site-header .header-actions > *{
        display:inline-flex!important;
        flex:0 0 auto!important;
        width:auto!important;
        min-width:max-content!important;
        min-height:34px!important;
        margin:0!important;
        padding:4px 0!important;
        white-space:nowrap!important;
      }
      .site-header .header-actions a,
      .site-header .header-actions button,
      .site-header .header-actions .btn{
        font-size:.75rem!important;
        font-weight:800!important;
        line-height:1!important;
        color:#000!important;
        background:transparent!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
      }
      .site-header .header-actions a i,
      .site-header .header-actions button i,
      .site-header .header-actions .btn i{font-size:1rem!important;color:inherit!important}
      .site-header .header-actions button[data-theme-toggle="true"]{
        position:static!important;
        width:auto!important;
        height:auto!important;
        min-width:max-content!important;
        min-height:34px!important;
        padding:4px 0!important;
        flex-direction:row!important;
        font-size:.75rem!important;
        font-weight:800!important;
      }
    }
    @media(max-width:480px){
      .site-header .header-actions{gap:17px!important}
      .site-header .header-actions a,
      .site-header .header-actions button,
      .site-header .header-actions .btn{font-size:.68rem!important;min-height:32px!important}
      .site-header .header-actions button[data-theme-toggle="true"]{min-height:32px!important;font-size:.68rem!important}
      .site-header .header-actions a i,
      .site-header .header-actions button i,
      .site-header .header-actions .btn i{font-size:.92rem!important}
    }
    /* Dark mode changes only text/icon contrast, never the item backgrounds. */
    html.dark .site-header .header-actions a,
    html.dark .site-header .header-actions button,
    html.dark .site-header .header-actions .btn,
    body.dark .site-header .header-actions a,
    body.dark .site-header .header-actions button,
    body.dark .site-header .header-actions .btn{color:#fff!important;background:transparent!important;border:0!important;box-shadow:none!important}
  `;document.head.appendChild(style)}
  function removeLegacyNavigationColours(){
    ['manlung-colour-nav','manlung-home-mobile-nav','manlung-header-style','manlung-site-logo-style'].forEach(id=>{
      const style=document.getElementById(id);
      if(style) style.remove();
    });
  }
  installHeroBaseStyle();
  function readTheme(){try{return localStorage.getItem(STORAGE_KEY)===DARK?DARK:LIGHT}catch(_){return LIGHT}}function writeTheme(theme){try{localStorage.setItem(STORAGE_KEY,theme)}catch(_){} }
  function setTheme(theme,persist=true){const next=theme===DARK?DARK:LIGHT,root=document.documentElement;root.classList.toggle('dark',next===DARK);root.dataset.theme=next;root.style.colorScheme=next;if(document.body)document.body.classList.toggle('dark',next===DARK);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',next===DARK?'#050b16':'#ffffff');document.querySelectorAll('[data-theme-toggle]').forEach(button=>{const isDark=next===DARK;button.setAttribute('aria-pressed',String(isDark));button.setAttribute('aria-label',isDark?'Switch to light mode':'Switch to dark mode');button.title=isDark?'Switch to light mode':'Switch to dark mode';const icon=button.querySelector('i'),label=button.querySelector('[data-theme-label]');if(icon)icon.className=isDark?'fas fa-sun':'fas fa-moon';if(label)label.textContent=isDark?'Light':'Dark';else button.innerHTML=`<i class="fas ${isDark?'fa-sun':'fa-moon'}" aria-hidden="true"></i><span data-theme-label>${isDark?'Light':'Dark'}</span>`});if(persist)writeTheme(next);return next}
  setTheme(readTheme(),false);function bindThemeButtons(){document.querySelectorAll('[data-theme-toggle]').forEach(button=>{if(button.dataset.themeBound==='true')return;button.dataset.themeBound='true';button.addEventListener('click',()=>setTheme(readTheme()===DARK?LIGHT:DARK,true))})}
  function createThemeButton(){if(document.querySelector('[data-theme-toggle]'))return;const button=document.createElement('button');button.type='button';button.className='btn btn-outline manlung-theme-toggle';button.dataset.themeToggle='true';button.innerHTML='<i class="fas fa-moon" aria-hidden="true"></i><span data-theme-label>Dark</span>';const actions=document.querySelector('.site-header .header-actions');if(actions)actions.insertBefore(button,actions.firstChild);else{button.className='manlung-floating-theme';document.body.appendChild(button)}bindThemeButtons()}
  function convertLegacyButtons(){document.querySelectorAll('[onclick="toggleDarkMode()"]').forEach(button=>{button.removeAttribute('onclick');button.dataset.themeToggle='true'})}
  function installCallIconFix(){if(document.getElementById('manlung-floating-call-icon-fix'))return;const s=document.createElement('style');s.id='manlung-floating-call-icon-fix';s.textContent=`#callWidgetBtn img.manlung-floating-call-icon{width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;max-width:20px!important;max-height:20px!important;flex:0 0 20px!important;display:inline-block!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important;vertical-align:middle!important}@media(max-width:600px){#callWidgetBtn img.manlung-floating-call-icon{width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;max-width:28px!important;max-height:28px!important;flex:0 0 28px!important}}`;document.head.appendChild(s)}
  function loadAdminCallIcons(){if(!location.pathname.startsWith('/admin/'))return;if(document.querySelector('script[data-manlung-admin-call-icons]'))return;const script=document.createElement('script');script.src='/js/admin-call-icons.js';script.defer=true;script.dataset.manlungAdminCallIcons='true';document.head.appendChild(script)}
  function loadContactFab(){if(document.querySelector('script[data-manlung-contact-fab]'))return;const script=document.createElement('script');script.src='/js/contact-fab.js';script.defer=true;script.dataset.manlungContactFab='true';document.head.appendChild(script)}
  function loadManlungAI(){if(document.querySelector('script[data-manlung-ai]'))return;const script=document.createElement('script');script.src='/js/manlung-ai-v2.js';script.defer=true;script.dataset.manlungAi='true';document.head.appendChild(script);script.addEventListener('load',()=>{if(document.querySelector('script[data-manlung-ai-live]'))return;const live=document.createElement('script');live.src='/js/manlung-ai-live.js';live.defer=true;live.dataset.manlungAiLive='true';document.head.appendChild(live)})}
  function loadClientCaseChat(){if(!location.pathname.startsWith('/client/track.html'))return;if(document.querySelector('script[data-manlung-client-case-chat]'))return;const script=document.createElement('script');script.src='/js/client-case-chat.js?v=20260906c';script.defer=true;script.dataset.manlungClientCaseChat='true';document.head.appendChild(script)}
  function installHeroVideoPlaylist(){const CLIPS=[CLIP_1,'https://raw.githubusercontent.com/markchtechcomputers/galary-/main/YTDown.com_YouTube_cyber-security-stock-footage-free-video-_Media_Z4F3AXvrLKo_001_1080p.mp4','https://raw.githubusercontent.com/markchtechcomputers/galary-/main/WhatsApp%20Video%202026-08-18%20at%203.06.03%20PM.mp4'],hero=document.querySelector('.hero');if(!hero||!CLIPS.length)return;const existing=Array.from(hero.querySelectorAll('.hero-video'));if(!existing.length)return;const seed=existing[0],video=seed.cloneNode(true);existing.forEach(node=>node.remove());video.id='heroVideoPlaylist';video.className='hero-video';video.dataset.manlungPlaylist='true';video.muted=true;video.defaultMuted=true;video.autoplay=true;video.loop=false;video.controls=false;video.playsInline=true;video.setAttribute('muted','');video.setAttribute('autoplay','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.preload='auto';video.style.opacity='0';video.style.transition='opacity .25s ease';hero.insertBefore(video,hero.firstChild);let current=0,switching=false,loadTimer=null,hasStarted=false;function clearLoadTimer(){if(loadTimer)clearTimeout(loadTimer);loadTimer=null}function reveal(){hasStarted=true;clearLoadTimer();video.style.opacity='0.78'}function startPlayback(){if(document.hidden)return;const p=video.play();if(p&&p.catch)p.catch(()=>{})}function playClip(index){current=(index+CLIPS.length)%CLIPS.length;switching=false;hasStarted=false;clearLoadTimer();const wanted=CLIPS[current],active=video.currentSrc||video.src||video.querySelector('source')?.src||'';if(active.split('?')[0]!==wanted.split('?')[0]){video.pause();video.removeAttribute('src');video.innerHTML='';video.src=wanted;video.load()}loadTimer=setTimeout(()=>{if(!hasStarted&&!switching)nextClip()},60000);startPlayback()}function nextClip(){if(switching)return;switching=true;clearLoadTimer();video.style.opacity='0';playClip(current+1)}video.addEventListener('loadeddata',()=>{reveal();startPlayback()});video.addEventListener('canplay',()=>{reveal();startPlayback()});video.addEventListener('playing',reveal);video.addEventListener('ended',nextClip);video.addEventListener('error',nextClip);document.addEventListener('visibilitychange',()=>{if(!document.hidden)startPlayback()});window.addEventListener('pageshow',startPlayback);['touchstart','pointerdown','click'].forEach(eventName=>document.addEventListener(eventName,startPlayback,{passive:true,once:true}));video.src=CLIPS[0];video.load();playClip(0)}
  function boot(){convertLegacyButtons();removeLegacyNavigationColours();bindThemeButtons();createThemeButton();bindThemeButtons();setTheme(readTheme(),false);installCallIconFix();installHeaderPolish();loadAdminCallIcons();loadContactFab();loadManlungAI();loadClientCaseChat();installHeroVideoPlaylist();window.setManlungTheme=theme=>setTheme(theme,true);window.toggleDarkMode=()=>setTheme(readTheme()===DARK?LIGHT:DARK,true)}
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)setTheme(readTheme(),false)});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();