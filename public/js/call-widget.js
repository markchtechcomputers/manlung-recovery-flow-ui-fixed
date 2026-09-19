/* Client "Call Admin" widget — floating contact control + existing WebRTC panel.
   Call Admin is free. The existing authenticated WebRTC/session flow is kept;
   the contact menu is integrated here so only one floating control exists. */

(function injectCallWidgetStyles() {
  if (document.getElementById('manlung-call-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'manlung-call-ui-styles';
  style.textContent = `
    #callWidget { --call-green:#20c77a; --call-green-dark:#128a55; --call-red:#ef4444; --call-blue:#4f8cff; --call-bg:#0b1428; --call-card:#111d35; --call-border:rgba(255,255,255,.10); --call-muted:#9fb0ca; }
    #callWidgetBtn { min-height:48px !important; padding:.72rem 1.05rem !important; border-radius:999px !important; background:linear-gradient(135deg,#20c77a,#128a55) !important; box-shadow:0 10px 30px rgba(18,138,85,.30) !important; transition:transform .2s ease,box-shadow .2s ease !important; }
    #callWidgetBtn:hover { transform:translateY(-2px) !important; box-shadow:0 14px 34px rgba(18,138,85,.42) !important; }
    .manlung-floating-call-icon{width:27px;height:27px;flex:0 0 27px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#fff}
    .manlung-floating-call-icon img{width:100%;height:100%;object-fit:cover;display:block}
    #callWidgetPanel { background:radial-gradient(circle at top,#1b315d 0,#101b32 42%,#0b1428 100%) !important; border:1px solid var(--call-border) !important; border-radius:22px !important; padding:1rem !important; box-shadow:0 24px 70px rgba(0,0,0,.48) !important; backdrop-filter:blur(18px); }
    #manlungContactMenu{position:absolute;right:0;bottom:62px;width:auto;min-width:0;padding:0;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible;}
    #manlungContactMenu[hidden]{display:none!important;}
    #manlungContactMenu .manlung-contact-menu-actions{display:flex;flex-direction:column;align-items:center;gap:12px;padding:0;background:transparent;}
    #manlungContactMenu .manlung-contact-choice,
    #manlungContactMenu .manlung-contact-close-icon{width:54px;height:54px;min-width:54px;min-height:54px;margin:0;padding:0;border:1px solid #e5e7eb;border-radius:50%;display:grid;place-items:center;background:#fff;color:#111827;text-decoration:none;box-shadow:0 10px 26px rgba(0,0,0,.18);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease,border-color .18s ease;}
    #manlungContactMenu .manlung-contact-choice-icon{display:grid;place-items:center;width:100%;height:100%;}
    #manlungContactMenu .manlung-contact-choice i{margin:0;font-size:1.35rem;color:#111827!important;}
    #manlungContactMenu .manlung-contact-choice-icon img{width:32px;height:32px;object-fit:contain;display:block;border-radius:8px;}
    #manlungContactMenu .manlung-contact-choice-icon{background:#fff;border-radius:50%;}
    #manlungContactMenu .manlung-contact-choice-icon img[src*="whatsapp"]{border-radius:50%;}
    #manlungContactMenu .manlung-contact-choice-icon img[src*="telegram"]{border-radius:50%;}
    #manlungContactMenu .manlung-contact-choice:hover,
    #manlungContactMenu .manlung-contact-close-icon:hover{transform:translateY(-3px) scale(1.05);background:#fff;border-color:#cbd5e1;box-shadow:0 14px 32px rgba(0,0,0,.22);color:#000;}
    #manlungContactMenu .manlung-contact-close-icon{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;}
    #manlungContactMenu .manlung-contact-close-icon i{font-size:1rem;color:#111827!important;}
    #manlungContactMenu .manlung-contact-choice-label{display:none!important;}
    @media(max-width:650px){#manlungContactMenu{right:0;bottom:60px;}#manlungContactMenu .manlung-contact-choice{width:50px;height:50px;min-width:50px;min-height:50px;}#manlungContactMenu .manlung-contact-choice i{font-size:1.2rem;}#manlungContactMenu .manlung-contact-close-icon{width:42px;height:42px;min-width:42px;min-height:42px;}}

    #callWidgetContent { text-align:center; }
    .manlung-call-avatar { width:82px;height:82px;margin:.35rem auto .85rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#244b82,#162b50);border:3px solid rgba(255,255,255,.10);box-shadow:0 10px 35px rgba(0,0,0,.35);position:relative; }
    .manlung-call-avatar i { font-size:2.1rem;color:#dce9ff; }
    .manlung-call-avatar.calling { animation:manlungCallPulse 1.5s infinite; }
    .manlung-call-avatar.calling:after { content:"";position:absolute;inset:-9px;border:2px solid rgba(32,199,122,.45);border-radius:50%;animation:manlungRing 1.5s infinite; }
    .manlung-call-name { font-size:1.05rem;font-weight:800;color:#fff;margin:.15rem 0; }
    .manlung-call-status { color:var(--call-muted);font-size:.82rem;margin:.2rem 0 .9rem; }
    .manlung-call-connected { color:#4ade80 !important;font-weight:800; }
    .manlung-call-timer { font-size:2rem !important;font-weight:800 !important;letter-spacing:.08em;color:#fff !important;margin:.65rem 0 1rem !important; }
    .manlung-call-actions { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
    .manlung-call-action { border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:.72rem .5rem;color:#fff;background:#1a2a49;cursor:pointer;font-weight:700;transition:transform .15s ease,background .15s ease; }
    .manlung-call-action:hover { transform:translateY(-1px);background:#22375e; }
    .manlung-call-action.end,.manlung-call-action.decline { background:linear-gradient(135deg,#ef4444,#b91c1c); }
    .manlung-call-action.accept { background:linear-gradient(135deg,#20c77a,#128a55); }
    .manlung-call-action.cancel { width:100%;margin-top:.7rem;background:#7f1d1d; }
    .manlung-call-action i { margin-right:5px; }
    .manlung-call-badge { display:inline-flex;align-items:center;gap:6px;padding:.35rem .7rem;border-radius:999px;background:rgba(32,199,122,.12);color:#4ade80;font-size:.72rem;font-weight:800;margin-bottom:.45rem; }
    .manlung-call-badge .dot { width:7px;height:7px;border-radius:50%;background:#4ade80;animation:manlungBlink 1s infinite; }
    .manlung-incoming-avatar { width:72px;height:72px;margin:0 auto .75rem;border-radius:50%;overflow:hidden;position:relative;border:3px solid rgba(74,222,128,.85);box-shadow:0 0 0 5px rgba(74,222,128,.10),0 8px 25px rgba(0,0,0,.30);animation:manlungCallPulse 1.4s ease-in-out infinite;background:#1f6e4a; }
    .manlung-incoming-avatar img { width:100%;height:100%;object-fit:cover;display:block; }
    .manlung-incoming-avatar i { width:100%;height:100%;align-items:center;justify-content:center;color:#fff;font-size:28px; }
    .manlung-call-avatar img { width:100%;height:100%;object-fit:cover;display:block;border-radius:50%; }
    .manlung-call-avatar-small { width:44px;height:44px;margin:0 auto .45rem;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,.75);background:#1f6e4a;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center; }
    .manlung-call-avatar-small img { width:100%;height:100%;object-fit:cover;display:block; }
    @keyframes manlungCallPulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.06)} }
    @keyframes manlungRing { 0%{transform:scale(.85);opacity:.8}100%{transform:scale(1.25);opacity:0} }
    @keyframes manlungBlink { 0%,100%{opacity:1}50%{opacity:.35} }
    @media(max-width:600px){#callWidget{right:10px !important;bottom:calc(10px + env(safe-area-inset-bottom)) !important}#callWidgetBtn{min-width:48px !important;width:48px !important;height:48px !important;padding:0 !important;justify-content:center !important}#callWidgetBtn #callWidgetLabel{display:none}#callWidgetPanel{width:min(340px,calc(100vw - 20px)) !important;right:0 !important;bottom:58px !important;border-radius:20px !important}}
    #manlungContactMenu{position:absolute;right:0;bottom:68px;width:min(320px,calc(100vw - 24px));max-height:min(70vh,430px);overflow:auto;padding:.85rem;border:1px solid rgba(255,255,255,.13);border-radius:20px;background:rgba(10,23,46,.98);color:#eef5ff;box-shadow:0 22px 60px rgba(0,0,0,.42);backdrop-filter:blur(18px)}
    #manlungContactMenu[hidden]{display:none !important}.manlung-contact-menu-header{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.25rem .2rem .75rem;border-bottom:1px solid rgba(255,255,255,.09)}.manlung-contact-menu-header strong{display:block;font-size:.95rem}.manlung-contact-menu-header span{display:block;margin-top:.2rem;color:#aebdd2;font-size:.72rem;line-height:1.4}#manlungContactClose{width:34px;height:34px;flex:0 0 34px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#172845;color:#fff;cursor:pointer}.manlung-contact-menu-actions{display:flex;flex-direction:column;align-items:center;gap:.8rem;padding:.8rem 0 0;background:transparent;box-shadow:none;border:0}.manlung-contact-choice{width:42px !important;height:42px !important;min-width:42px !important;min-height:42px !important;box-sizing:border-box;display:flex !important;align-items:center !important;justify-content:center !important;padding:0 !important;margin:0 auto !important;border:0 !important;border-radius:50% !important;background:transparent !important;color:#fff;text-decoration:none;cursor:pointer;transition:transform .16s ease;position:relative;overflow:hidden}.manlung-contact-choice img{width:34px !important;height:34px !important;min-width:34px !important;min-height:34px !important;max-width:34px !important;max-height:34px !important;object-fit:contain !important;border-radius:50% !important;display:block !important;visibility:visible !important;opacity:1 !important}.manlung-contact-choice:hover{background:transparent !important;border:0 !important;box-shadow:none !important;transform:scale(1.08)}.manlung-contact-choice .manlung-contact-choice-label{display:none !important}.manlung-contact-choice-icon{width:42px !important;height:42px !important;display:flex !important;align-items:center !important;justify-content:center !important}.manlung-contact-choice-icon img{width:34px !important;height:34px !important;max-width:34px !important;max-height:34px !important;object-fit:contain !important;display:block !important}.manlung-contact-choice:focus-visible,#manlungContactClose:focus-visible,#callWidgetBtn:focus-visible{outline:3px solid rgba(96,165,250,.85);outline-offset:3px}.manlung-contact-choice-icon{width:42px !important;height:42px !important;display:grid;place-items:center;border-radius:50%;overflow:hidden}.manlung-contact-choice-icon img{width:34px !important;height:34px !important;object-fit:contain;display:block}.manlung-contact-choice .manlung-contact-choice-label{position:absolute;left:50%;bottom:-30px;transform:translateX(-50%);white-space:nowrap;padding:.28rem .45rem;border-radius:7px;background:#071321;color:#fff;font-size:.64rem;opacity:0;pointer-events:none;transition:opacity .15s ease;z-index:5}.manlung-contact-choice:hover .manlung-contact-choice-label,.manlung-contact-choice:focus-visible .manlung-contact-choice-label{opacity:1}.manlung-contact-call .manlung-contact-choice-icon{background:#155e3d}.manlung-call-loading{display:grid;place-items:center;text-align:center;padding:1rem .5rem}.manlung-call-loading img{width:72px;height:72px;border-radius:18px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,.3);margin-bottom:.7rem}.manlung-call-dots{display:flex;gap:6px;justify-content:center;margin-top:.55rem}.manlung-call-dots span{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:manlungCallDot 1s infinite ease-in-out}.manlung-call-dots span:nth-child(2){animation-delay:.15s}.manlung-call-dots span:nth-child(3){animation-delay:.3s}@keyframes manlungCallDot{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-5px)}}@media(max-width:600px){#manlungContactMenu{right:-2px;bottom:60px;width:min(320px,calc(100vw - 20px));max-height:calc(100vh - 90px)}.manlung-contact-menu-actions{gap:.6rem}.manlung-contact-choice{height:42px}.manlung-contact-choice-icon{width:42px;height:42px}}

    /* Enhanced Contact Us / Call Admin presentation — UI only; WebRTC logic untouched. */
    #callWidget{filter:drop-shadow(0 12px 28px rgba(0,0,0,.22));}
    #callWidgetBtn{
      position:relative;
      overflow:visible !important;
      background:linear-gradient(135deg,#0f2f63,#164b91 55%,#20a967) !important;
      border:1px solid rgba(255,255,255,.18) !important;
      box-shadow:0 12px 34px rgba(8,30,70,.42),0 0 0 1px rgba(32,199,122,.14) inset !important;
    }
    #callWidgetBtn:before{
      content:"";
      position:absolute;
      inset:-5px;
      border-radius:999px;
      border:1px solid rgba(74,222,128,.32);
      pointer-events:none;
      animation:manlungContactGlow 2.4s ease-out infinite;
    }
    #callWidgetBtn:after{
      content:"";
      position:absolute;
      right:7px;
      top:6px;
      width:8px;
      height:8px;
      border-radius:50%;
      background:#4ade80;
      box-shadow:0 0 12px rgba(74,222,128,.9);
    }

    .manlung-floating-call-icon{
      width:30px !important;
      height:30px !important;
      flex-basis:30px !important;
      border:2px solid rgba(255,255,255,.28);
      box-shadow:0 0 0 3px rgba(32,199,122,.16),0 5px 15px rgba(0,0,0,.25);
    }

    #manlungContactMenu{
      padding:1rem !important;
      background:#ffffff !important;
      border:1px solid #e5e7eb !important;
      border-radius:22px !important;
      box-shadow:0 24px 55px rgba(0,0,0,.18),0 0 30px rgba(255,255,255,.95) !important;
      color:#111827 !important;
    }

    .manlung-contact-menu-header{
      padding:.2rem .1rem .85rem !important;
    }

    .manlung-contact-menu-header strong{
      font-size:1rem !important;
      letter-spacing:.01em;
    }

    .manlung-contact-menu-header span{
      color:#475569 !important;
    }

    #manlungContactClose{
      background:linear-gradient(145deg,#20365d,#13233f) !important;
      border-color:rgba(255,255,255,.15) !important;
      box-shadow:0 5px 16px rgba(0,0,0,.22);
    }

    .manlung-contact-menu-actions{
      display:flex !important;
      flex-direction:column !important;
      gap:.7rem !important;
      padding:.9rem 0 .1rem !important;
      align-items:stretch !important;
    }

    .manlung-contact-choice{
      width:100% !important;
      height:58px !important;
      min-width:0 !important;
      min-height:58px !important;
      display:flex !important;
      flex-direction:row !important;
      align-items:center !important;
      justify-content:flex-start !important;
      gap:.75rem !important;
      padding:.45rem .7rem !important;
      margin:0 !important;
      border:1px solid rgba(255,255,255,.09) !important;
      border-radius:15px !important;
      background:linear-gradient(145deg,#111827,#1f2937) !important;
      box-shadow:0 8px 22px rgba(15,23,42,.22),0 0 18px rgba(255,255,255,.18) !important;
    }

    .manlung-contact-choice:hover{
      background:linear-gradient(145deg,#1f2937,#334155) !important;
      transform:translateY(-2px) scale(1.015) !important;
      border-color:rgba(96,165,250,.35) !important;
      box-shadow:0 12px 24px rgba(0,0,0,.24) !important;
    }

    .manlung-contact-choice-icon{
      width:42px !important;
      height:42px !important;
      flex:0 0 42px !important;
      border-radius:13px !important;
      background:#ffffff !important;
      border:2px solid #ffffff !important;
      box-shadow:0 0 0 3px #ffffff,0 0 18px rgba(255,255,255,1),0 7px 18px rgba(0,0,0,.16);
    }

    .manlung-contact-choice-icon img{
      width:32px !important;
      height:32px !important;
      max-width:32px !important;
      max-height:32px !important;
    }

    .manlung-contact-choice .manlung-contact-choice-label{
      display:block !important;
      position:static !important;
      transform:none !important;
      opacity:1 !important;
      background:none !important;
      padding:0 !important;
      color:#ffffff !important;
      text-shadow:0 1px 8px rgba(255,255,255,.18);
      font-size:.82rem !important;
      font-weight:800 !important;
      pointer-events:none !important;
    }

    .manlung-contact-call{
      background:linear-gradient(145deg,#0f172a,#14532d) !important;
      border-color:rgba(255,255,255,.22) !important;
      box-shadow:0 9px 24px rgba(15,23,42,.24),0 0 20px rgba(255,255,255,.18) !important;
    }

    .manlung-contact-call:hover{
      background:linear-gradient(145deg,#118154,#176b4b) !important;
      border-color:rgba(74,222,128,.65) !important;
    }

    .manlung-contact-call .manlung-contact-choice-icon{
      background:#ffffff !important;
      border:2px solid #ffffff !important;
      box-shadow:0 0 0 4px rgba(255,255,255,.18),0 0 20px rgba(255,255,255,.95),0 6px 16px rgba(0,0,0,.2);
      animation:manlungPhonePulse 1.9s ease-in-out infinite;
    }

    #callWidgetPanel{
      background:linear-gradient(180deg,#12254a,#0b1730) !important;
      border-color:rgba(96,165,250,.22) !important;
      box-shadow:0 24px 65px rgba(0,0,0,.5) !important;
    }

    @keyframes manlungContactGlow{
      0%{transform:scale(.98);opacity:.7}
      70%,100%{transform:scale(1.08);opacity:0}
    }

    @keyframes manlungPhonePulse{
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.07)}
    }

    @media(max-width:600px){
      #callWidgetBtn:after{
        right:5px;
        top:5px;
        width:7px;
        height:7px;
      }

      #manlungContactMenu{
        width:min(330px,calc(100vw - 18px)) !important;
        padding:.85rem !important;
        right:-2px !important;
      }

      .manlung-contact-menu-actions{
        gap:.6rem !important;
      }

      .manlung-contact-choice{
        height:72px !important;
        min-height:72px !important;
      }
    }
    /* Final contact icon cleanup: remove every dark holder/line around the icons. */
    #manlungContactMenu .manlung-contact-menu-actions{
      background:transparent !important;
      border:0 !important;
      box-shadow:none !important;
      outline:0 !important;
    }
    #manlungContactMenu .manlung-contact-choice,
    #manlungContactMenu .manlung-contact-choice:hover,
    #manlungContactMenu .manlung-contact-choice:focus,
    #manlungContactMenu .manlung-contact-choice:active{
      background:transparent !important;
      border:0 !important;
      outline:0 !important;
      box-shadow:none !important;
    }
    #manlungContactMenu .manlung-contact-choice-icon,
    #manlungContactMenu .manlung-contact-call .manlung-contact-choice-icon{
      background:#fff !important;
      border:2px solid #fff !important;
      outline:0 !important;
      box-shadow:0 0 0 2px #fff,0 0 16px 5px rgba(255,255,255,1),0 0 30px 8px rgba(255,255,255,.72) !important;
    }
    #manlungContactMenu .manlung-contact-choice-icon img{
      border:0 !important;
      outline:0 !important;
      box-shadow:none !important;
    }
    #manlungContactMenu .manlung-contact-choice .manlung-contact-choice-label{
      color:#fff !important;
    }

  `;
  document.head.appendChild(style);
})();

(function(){
  let currentPeer=null,currentSessionId=null,pollTimer=null,currentCallbackId=null,callbackPollTimer=null,lastQueuePosition=null,lastQueueNotice=0;
  const MANLUNG_ADMIN_ICON="https://i.postimg.cc/FHBztf67/Chat-GPT-Image-Aug-31-2026-11-17-24-AM.png";
  const MANLUNG_CLIENT_ICON="https://i.postimg.cc/RFfNLMXT/Chat-GPT-Image-Aug-31-2026-11-16-19-AM.png";
  function el(html){const div=document.createElement('div');div.innerHTML=html.trim();return div.firstChild;}
  function csrfToken(){
    const names=['__Host-mlc_csrf','mlc_csrf'];
    for(const name of names){const prefix=`${name}=`;const item=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(prefix));if(item){try{return decodeURIComponent(item.slice(prefix.length));}catch(_){return null;}}}
    return null;
  }
  function authHeaders(){
    const token=localStorage.getItem('clientToken');
    if(!token)return null;
    const headers={Authorization:`Bearer ${token}`};
    const csrf=csrfToken();
    if(csrf)headers['X-CSRF-Token']=csrf;
    return headers;
  }
  function clearInvalidClientSession(){localStorage.removeItem('clientToken');localStorage.removeItem('clientUser');}
  async function verifyClientSession(headers){if(!headers)return false;try{const response=await fetch('/api/auth/verify',{headers,cache:'no-store'});if(response.ok){const data=await response.json().catch(()=>({}));return data.success===true&&data.user?.role==='client';}if(response.status===401||response.status===403)clearInvalidClientSession();return false;}catch(_){return false;}}
  function showSignInRequired(){const panel=panelContent();panel.innerHTML=panelHtml(`<div class="manlung-call-loading"><img src="https://i.postimg.cc/CxLDpd5z/istockphoto-971654072-612x612-Photoroom.png" alt="Call Admin"><strong>Your client session has expired.</strong><span style="color:#96abc4;margin-top:.35rem;">Please sign in again before starting a secure browser call.</span><a href="/login.html" style="display:block;width:100%;box-sizing:border-box;margin-top:.8rem;text-align:center;background:#2451d6;color:#fff;padding:.6rem;border-radius:10px;text-decoration:none;font-weight:700;">Sign In</a></div>`);}
  function callLoadingHtml(message){return `<div class="manlung-call-loading"><img src="https://i.postimg.cc/CxLDpd5z/istockphoto-971654072-612x612-Photoroom.png" alt="Manlung Recovery Call"><strong>${message}</strong><div class="manlung-call-dots" aria-label="Loading"><span></span><span></span><span></span></div></div>`;}
  function buildWidget(){const existing=document.getElementById('callWidget');if(existing)return existing;const wrap=el(`<div id="callWidget" style="position:fixed;bottom:calc(12px + env(safe-area-inset-bottom));right:12px;z-index:200;font-family:'Inter',-apple-system,sans-serif;"><button id="callWidgetBtn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="manlungContactMenu" title="Contact Manlung Recovery" style="background:#1f6e4a;color:#fff;border:none;border-radius:50px;padding:0.7rem 1.1rem;font-weight:600;font-size:0.85rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;"><span class="manlung-floating-call-icon" aria-hidden="true"><img src="https://i.postimg.cc/YS3mGvPj/contact-us-sticker-vector-47086176-Photoroom.png" alt=""></span><span id="callWidgetLabel">Contact Us</span></button><div id="manlungContactMenu" role="dialog" aria-modal="false" aria-label="Contact options" hidden><div class="manlung-contact-menu-actions"><button class="manlung-contact-choice manlung-contact-call" type="button" data-contact-action="call" aria-label="Call Admin" title="Call Admin"><span class="manlung-contact-choice-icon" aria-hidden="true"><img src="https://i.postimg.cc/CxLDpd5z/istockphoto-971654072-612x612-Photoroom.png" alt=""></span></button><a class="manlung-contact-choice" data-contact-action="whatsapp" aria-label="WhatsApp" title="WhatsApp" href="https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%20%F0%9F%91%8B%2C%20I%20need%20help%20with%20my%20recovery%20request." target="_blank" rel="noopener noreferrer"><span class="manlung-contact-choice-icon" aria-hidden="true"><img src="https://i.postimg.cc/ZR3vxdsW/whatsapp-whatsapp-app-logo-in-green-circle-AZU1A2SU-t-Photoroom.png" alt=""></span></a><a class="manlung-contact-choice" data-contact-action="email" aria-label="Email" title="Email" href="mailto:manlungrecovery@outlook.com?subject=Manlung%20Recovery%20Support"><span class="manlung-contact-choice-icon" aria-hidden="true"><img src="https://i.postimg.cc/vHXghMhL/125376099-mail-symbol-icon-red-simple-with-rounded-corners-isolated-vector-illustration-Photoroom.png" alt=""></span></a><a class="manlung-contact-choice" data-contact-action="telegram" aria-label="Telegram" title="Telegram" href="https://t.me/manlungtechcitybot" target="_blank" rel="noopener noreferrer"><span class="manlung-contact-choice-icon" aria-hidden="true"><img src="https://i.postimg.cc/MH6ZfMht/telegram-icon.jpg" alt=""></span></a><button id="manlungContactClose" class="manlung-contact-close-icon" type="button" aria-label="Close contact options" title="Close"><i class="fas fa-times" aria-hidden="true"></i></button></div></div><div id="callWidgetPanel" style="display:none;position:absolute;bottom:56px;right:0;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 100px);overflow:auto;background:#101f42;color:#e6ecf5;border:1px solid #29385a;border-radius:16px;padding:1.1rem;box-shadow:0 10px 30px rgba(0,0,0,0.35);"><div style="display:flex;justify-content:flex-end;margin:-0.35rem -0.35rem 0.25rem 0;"><button id="callWidgetCloseBtn" type="button" aria-label="Close Call Admin panel" title="Close" style="width:34px;height:34px;border:0;border-radius:50%;background:#29385a;color:#fff;cursor:pointer;font-size:1rem;"><i class="fas fa-times"></i></button></div><div id="callWidgetContent"></div></div></div>`);document.body.appendChild(wrap);const button=document.getElementById('callWidgetBtn'),menu=document.getElementById('manlungContactMenu'),menuClose=document.getElementById('manlungContactClose'),callChoice=menu?.querySelector('[data-contact-action="call"]');button.addEventListener('click',toggleContactMenu);menuClose?.addEventListener('click',()=>closeContactMenu({restoreFocus:true}));callChoice?.addEventListener('click',()=>{closeContactMenu();openCallAdminPanel();});document.addEventListener('keydown',handleContactKeydown);document.addEventListener('click',handleContactOutsideClick);return wrap;}
  function toggleContactMenu(event){event?.preventDefault();event?.stopPropagation();const menu=document.getElementById('manlungContactMenu'),button=document.getElementById('callWidgetBtn');if(!menu||!button)return;if(menu.hidden){closePanel();menu.hidden=false;button.setAttribute('aria-expanded','true');setTimeout(()=>menu.querySelector('.manlung-contact-choice')?.focus(),0);}else closeContactMenu();}
  function closeContactMenu({restoreFocus=false}={}){const menu=document.getElementById('manlungContactMenu'),button=document.getElementById('callWidgetBtn');if(!menu||!button)return;menu.hidden=true;button.setAttribute('aria-expanded','false');if(restoreFocus)button.focus();}
  function openCallAdminPanel(){const panel=document.getElementById('callWidgetPanel');if(!panel)return;panel.style.display='block';if(!currentPeer)refreshEntitlementPanel();}
  function handleContactKeydown(event){const menu=document.getElementById('manlungContactMenu');if(!menu||menu.hidden)return;if(event.key==='Escape'){event.preventDefault();closeContactMenu({restoreFocus:true});return;}if(event.key==='Tab'){const focusable=[...menu.querySelectorAll('a,button')].filter(el=>!el.disabled);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
  function handleContactOutsideClick(event){const menu=document.getElementById('manlungContactMenu'),button=document.getElementById('callWidgetBtn');if(!menu||menu.hidden||!button)return;if(!menu.contains(event.target)&&!button.contains(event.target))closeContactMenu();}
  function closePanel(){const panel=document.getElementById('callWidgetPanel');if(panel)panel.style.display='none';}
  function panelHtml(inner){return `<div style="font-size:0.85rem;">${inner}</div>`;}
  function panelContent(){return document.getElementById('callWidgetContent')||document.getElementById('callWidgetPanel');}
  function ringtoneSettingsHtml(role='client'){const options=window.ManlungCallRingtone?.options||[];const current=window.ManlungCallRingtone?.get(role)||options[0]?.id||'';return `<div style="margin-top:.85rem;padding-top:.75rem;border-top:1px solid #29385a;"><label for="callRingtoneSelect" style="display:block;font-weight:700;margin-bottom:.35rem;">Call ringtone</label><div style="display:flex;gap:7px;align-items:center;"><select id="callRingtoneSelect" style="flex:1;background:#17284d;color:#fff;border:1px solid #3b4d70;border-radius:9px;padding:.48rem;">${options.map(option=>`<option value="${option.id}" ${option.id===current?'selected':''}>${option.name}</option>`).join('')}</select><button id="testRingtoneBtn" type="button" style="background:#29385a;color:#fff;border:0;border-radius:9px;padding:.48rem .65rem;cursor:pointer;" title="Test ringtone">Test</button></div><small style="display:block;color:#96abc4;margin-top:.3rem;">Choose the sound used when an Admin calls you.</small></div>`;}
  function bindRingtoneSettings(role='client'){const select=document.getElementById('callRingtoneSelect'),test=document.getElementById('testRingtoneBtn');if(!select||!window.ManlungCallRingtone)return;select.addEventListener('change',()=>window.ManlungCallRingtone.set(select.value,role));test?.addEventListener('click',async()=>{window.ManlungCallRingtone.set(select.value,role);await window.ManlungCallRingtone.preview(role);});}
  function renderFreeCallPanel(){const panel=panelContent();panel.innerHTML=panelHtml(`<p style="font-weight:800;margin:0 0 .25rem;"><i class="fas fa-phone" style="color:#4ade80;"></i> Call Admin — Free</p><p style="color:#96abc4;margin:0 0 .8rem;">Get help directly from an available Admin. No phone subscription is required.</p><button id="callActionBtn" style="width:100%;background:#1f6e4a;color:#fff;border:none;padding:.65rem;border-radius:10px;font-weight:700;cursor:pointer;"><i class="fas fa-phone"></i> Call Admin</button><p id="callWidgetStatus" style="color:#96abc4;margin:.5rem 0 0;"></p>${ringtoneSettingsHtml('client')}`);document.getElementById('callActionBtn')?.addEventListener('click',()=>beginCall(authHeaders()));bindRingtoneSettings('client');}
  async function refreshEntitlementPanel(){const panel=panelContent(),headers=authHeaders();if(!headers){panel.innerHTML=panelHtml(`<p style="margin-bottom:.8rem;">Sign in to your client account to use Call Admin.</p><a href="/login.html" style="display:block;text-align:center;background:#2451d6;color:#fff;padding:.5rem;border-radius:10px;text-decoration:none;">Sign In</a>`);return;}if(!(await verifyClientSession(headers))){showSignInRequired();return;}renderFreeCallPanel();}
  let ringVibrateTimer=null;
  function startClientAlert(){if(window.ManlungCallRingtone)window.ManlungCallRingtone.start();if(navigator.vibrate){try{navigator.vibrate([500,250,500,250,900]);clearInterval(ringVibrateTimer);ringVibrateTimer=setInterval(()=>{try{navigator.vibrate([500,250,500,250,900]);}catch(_){}},2600);}catch(_){}}}
  function stopClientAlert(){if(window.ManlungCallRingtone)window.ManlungCallRingtone.stop();if(ringVibrateTimer)clearInterval(ringVibrateTimer);ringVibrateTimer=null;try{navigator.vibrate?.(0);}catch(_){} }
  async function beginCall(headers){if(currentPeer||currentSessionId)return;const panel=panelContent();panel.innerHTML=panelHtml(callLoadingHtml('Checking admin availability…'));if(!(await verifyClientSession(headers))){showSignInRequired();return;}try{const availabilityRes=await fetch('/api/calls/availability',{headers,cache:'no-store'});const availability=await availabilityRes.json();if(availabilityRes.status===401||availabilityRes.status===403){clearInvalidClientSession();showSignInRequired();return;}if(!availabilityRes.ok||!availability.success)throw new Error(availability.error||'Could not check admin availability.');if(availability.state==='offline'){panel.innerHTML=panelHtml('<p style="color:#f87171;">No admins are currently available. Please try again later or call back shortly.</p>');return;}if(availability.state==='busy'){panel.innerHTML=panelHtml('<p style="color:#fbbf24;">All admins are currently assisting other clients. Kindly hold or call back in a few minutes.</p><p style="color:#96abc4;margin-top:.5rem;">Your call can remain in the queue while you wait.</p>');await new Promise(resolve=>setTimeout(resolve,900));}else panel.innerHTML=panelHtml(callLoadingHtml('Connecting you to an available admin…'));const requestHeaders=authHeaders();if(!requestHeaders){showSignInRequired();return;}const startRes=await fetch('/api/calls/start',{method:'POST',headers:{'Content-Type':'application/json',...requestHeaders},body:JSON.stringify({})});const startData=await startRes.json();if(startRes.status===401||startRes.status===403){clearInvalidClientSession();showSignInRequired();return;}if(!startRes.ok||!startData.success){panel.innerHTML=panelHtml(`<p style="color:#f87171;">${startData.error||'Could not start call.'}</p>`);return;}currentSessionId=startData.sessionId;requestQueueNotifications();lastQueuePosition=null;renderCallUI(startData.status==='queued'?'queued':'calling',startData);startClientAlert();startPollingForStatus(requestHeaders);}catch(e){stopClientAlert();console.error(e);if(/invalid token|session (expired|revoked)/i.test(String(e.message||''))){clearInvalidClientSession();showSignInRequired();}else renderCallUI('connection-failed',e.message);}}
  function startPollingForStatus(headers){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(!currentSessionId){clearInterval(pollTimer);return;}try{const res=await fetch(`/api/calls/${currentSessionId}`,{headers});const data=await res.json();if(!res.ok||!data.success)return;const status=data.session.status;if(status==='ringing'||status==='queued'){const detail={...data.session,onlineCount:data.onlineCount,availableCount:data.availableCount};renderCallUI(status==='queued'?'queued':'calling',detail);return;}if(status==='accepted'&&!currentPeer){stopClientAlert();clearInterval(pollTimer);pollTimer=null;renderCallUI('requesting-mic');currentPeer=new window.ManlungCallWebRTC.CallPeer({sessionId:currentSessionId,isInitiator:true,headers,onStateChange:(state,detail)=>renderCallUI(state,detail),onDuration:d=>updateDuration(d)});try{await currentPeer.start();}catch(e){console.error('Client WebRTC start error:',e);if(/invalid token|session (expired|revoked)/i.test(String(e.message||''))){clearInvalidClientSession();showSignInRequired();}else renderCallUI('connection-failed',e.message);await endCall();}return;}if(['rejected','missed','ended'].includes(status)){stopClientAlert();clearInterval(pollTimer);pollTimer=null;renderCallUI(status==='rejected'?'rejected':status==='missed'?'no-admin-answered':'ended-by-remote');cleanupCall();}}catch(_){}},1000);}
  function notifyQueueUpdate(position,onlineCount,availableCount){
    const p=Number(position||0); if(!p)return;
    const now=Date.now(); const changed=lastQueuePosition!==p;
    if(changed){ lastQueuePosition=p; }
    const message=p===1?'You are next in line. An available Admin will be notified to take your call.':`You are #${p} in the waiting line. ${Number(onlineCount||0)} admin(s) online, ${Number(availableCount||0)} available.`;
    const el=document.getElementById('callQueueNotice'); if(el) el.textContent=message;
    if(changed && (now-lastQueueNotice>3000) && 'Notification' in window && Notification.permission==='granted'){
      new Notification(p===1?'Manlung Recovery — You are next':'Manlung Recovery — Queue update',{body:message,icon:MANLUNG_CLIENT_ICON}); lastQueueNotice=now;
    }
    if(p===1 && availableCount>0 && changed){ try{ window.speechSynthesis?.speak(new SpeechSynthesisUtterance('You are next in line. An admin is available.')); }catch(_){} }
  }
  async function requestQueueNotifications(){
    if('Notification' in window && Notification.permission==='default'){ try{ await Notification.requestPermission(); }catch(_){} }
  }
  function renderCallUI(state,detail){const panel=panelContent(),label=document.getElementById('callWidgetLabel');const states={'requesting-mic':`<p><i class="fas fa-microphone"></i> Requesting microphone access…</p>`,'queued':`<div class="manlung-call-loading"><strong>You’re in the waiting queue</strong><span id="callQueuePosition" style="color:#fbbf24;font-size:.9rem;font-weight:800;margin-top:.4rem;">Finding your position…</span><span id="callAdminAvailability" style="color:#96abc4;font-size:.78rem;margin-top:.35rem;">Admins online: checking…</span><span id="callQueueNotice" style="color:#fff;font-size:.86rem;font-weight:800;margin-top:.45rem;">You will be notified as your turn approaches.</span><span style="color:#96abc4;font-size:.78rem;margin-top:.2rem;">Stay on the line — your place in the queue is protected while other clients are being helped.</span><div class="manlung-call-dots" aria-label="Waiting"><span></span><span></span><span></span></div><button id="cancelCallBtn" style="width:100%;background:#c0392b;color:#fff;border:none;padding:0.5rem;border-radius:10px;font-weight:600;cursor:pointer;margin-top:.75rem;">Leave Queue</button></div>`, 'calling':`<div class="manlung-call-loading"><img src="https://i.postimg.cc/CxLDpd5z/istockphoto-971654072-612x612-Photoroom.png" alt="Manlung Recovery Call"><strong>Ringing Admin…</strong><span style="color:#96abc4;font-size:.78rem;margin-top:.35rem;">Waiting for an available administrator to answer.</span><div class="manlung-call-dots" aria-label="Calling"><span></span><span></span><span></span></div><button id="cancelCallBtn" style="width:100%;background:#c0392b;color:#fff;border:none;padding:0.5rem;border-radius:10px;font-weight:600;cursor:pointer;margin-top:0.75rem;">Cancel Call</button></div>`,'connecting':`<p><i class="fas fa-spinner fa-spin"></i> Connecting…</p>`,'connected':`<div id="connectedAdminAvatar" class="manlung-call-avatar-small" style="width:56px;height:56px;margin:0 auto .55rem;"><img src="${MANLUNG_ADMIN_ICON}" alt="Manlung Admin" loading="eager" onerror="this.style.display='none';"></div><p style="font-weight:600;color:#4ade80;">🟢 Connected</p><p id="connectedAdminName" style="color:#96abc4;margin:.2rem 0 .5rem;"></p><p id="callDuration" style="font-size:1.4rem;margin:0.4rem 0;">00:00</p><div style="display:flex;gap:8px;margin-bottom:8px;"><button id="speakerBtn" style="flex:1;background:#29385a;color:#fff;border:none;padding:0.5rem;border-radius:10px;cursor:pointer;"><i class="fas fa-volume-high"></i> Enable Audio</button></div><div style="display:flex;gap:8px;"><button id="muteBtn" style="flex:1;background:#29385a;color:#fff;border:none;padding:0.5rem;border-radius:10px;cursor:pointer;"><i class="fas fa-microphone"></i> Mute</button><button id="endCallBtn" style="flex:1;background:#c0392b;color:#fff;border:none;padding:0.5rem;border-radius:10px;cursor:pointer;"><i class="fas fa-phone-slash"></i> End</button></div></div>`,'reconnecting':`<p style="color:#facc15;"><i class="fas fa-triangle-exclamation"></i> Reconnecting…</p>`,'ended-by-remote':`<p>Call ended by admin.</p>`,'permission-denied':`<p style="color:#f87171;">Microphone permission denied. Allow microphone access to call.</p>`,'connection-failed':`<p style="color:#f87171;">Connection failed${detail?': '+detail:''}.</p>`,'no-admin-answered':`<p style="color:#f87171;">No administrator answered.</p><p style="color:#96abc4;">Please try again later.</p>`,'rejected':`<p style="color:#f87171;">Call was declined.</p>`};panel.innerHTML=panelHtml(states[state]||`<p>${state}</p>`);if(state==='calling'||state==='queued')startClientAlert();else if(['requesting-mic','connecting','connected','rejected','no-admin-answered','ended-by-remote','connection-failed','permission-denied'].includes(state))stopClientAlert();if(label)label.textContent=state==='connected'?'On Call':state==='queued'?'In Queue':'Call Admin';if((state==='queued'||state==='connected')&&currentSessionId){fetch(`/api/calls/${encodeURIComponent(currentSessionId)}`,{headers:authHeaders(),cache:'no-store'}).then(r=>r.json()).then(d=>{if(state==='queued'){const pos=document.getElementById('callQueuePosition');if(pos){const n=Number(d?.session?.queue_position||0);pos.textContent=n>0?`You are #${n} in line`:'Waiting for the next available Admin…';notifyQueueUpdate(n,d?.onlineCount,d?.availableCount);}}else{const nameEl=document.getElementById('connectedAdminName');if(nameEl)nameEl.textContent=d?.session?.admin_name?`Admin: ${d.session.admin_name}`:'';}}).catch(()=>{});}const cancelBtn=document.getElementById('cancelCallBtn');if(cancelBtn)cancelBtn.addEventListener('click',()=>endCall());const endBtn=document.getElementById('endCallBtn');if(endBtn)endBtn.addEventListener('click',()=>endCall());const speakerBtn=document.getElementById('speakerBtn');if(speakerBtn)speakerBtn.addEventListener('click',async()=>{const ok=await currentPeer?.enableRemoteAudio();speakerBtn.innerHTML=ok?'<i class="fas fa-volume-high"></i> Audio Enabled':'<i class="fas fa-triangle-exclamation"></i> Tap Again';});const muteBtn=document.getElementById('muteBtn');if(muteBtn)muteBtn.addEventListener('click',()=>{const isMuted=currentPeer?.toggleMute();muteBtn.innerHTML=isMuted?'<i class="fas fa-microphone-slash"></i> Unmute':'<i class="fas fa-microphone"></i> Mute';});}
  function updateDuration(text){const el=document.getElementById('callDuration');if(el)el.textContent=text;}
  async function endCall(){const headers=authHeaders();if(currentPeer)await currentPeer.end();if(currentSessionId&&headers){try{await fetch(`/api/calls/${currentSessionId}/end`,{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({reason:'client_hangup'})});}catch(e){}}cleanupCall();setTimeout(refreshEntitlementPanel,500);}
  function cleanupCall(){clearInterval(pollTimer);pollTimer=null;stopClientAlert();currentPeer=null;currentSessionId=null;}
  async function pollForAdminCallback(){const headers=authHeaders();if(!headers||currentPeer||currentSessionId)return;try{const res=await fetch('/api/calls/client/callbacks',{headers,cache:'no-store'});if(!res.ok)return;const data=await res.json().catch(()=>({}));const calls=data.success&&Array.isArray(data.calls)?data.calls:[];if(currentCallbackId){const stillPending=calls.some(call=>String(call.id)===String(currentCallbackId));if(!stillPending){currentCallbackId=null;stopClientAlert();refreshEntitlementPanel();return;}return;}if(calls.length)showAdminCallback(calls[0],headers);}catch(_) {}}
  function showAdminCallback(call,headers){if(currentCallbackId||currentPeer||currentSessionId)return;currentCallbackId=call.id;startClientAlert();const panel=panelContent();const adminName=call.admin_name||'Manlung Admin';panel.innerHTML=panelHtml(`<div style="text-align:center;"><div class="manlung-incoming-avatar"><img src="${MANLUNG_ADMIN_ICON}" alt="Manlung Admin" loading="eager" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><i class="fas fa-user-shield" style="display:none;"></i></div><p style="font-weight:700;margin-bottom:.35rem;">Incoming Call From ${adminName}</p><p style="color:#96abc4;margin-bottom:.8rem;">${call.case_id?`Case ${call.case_id}`:'Support callback'}</p><div style="display:flex;gap:8px;"><button id="rejectCallbackBtn" style="flex:1;background:#c0392b;color:#fff;border:0;padding:.55rem;border-radius:10px;cursor:pointer;"><i class="fas fa-phone-slash"></i> Decline</button><button id="acceptCallbackBtn" style="flex:1;background:#1f6e4a;color:#fff;border:0;padding:.55rem;border-radius:10px;cursor:pointer;"><i class="fas fa-phone"></i> Accept</button></div></div>`);document.getElementById('acceptCallbackBtn')?.addEventListener('click',()=>acceptAdminCallback(call.id,headers));document.getElementById('rejectCallbackBtn')?.addEventListener('click',()=>rejectAdminCallback(call.id,headers));}
  async function rejectAdminCallback(id,headers){stopClientAlert();try{await fetch(`/api/calls/${encodeURIComponent(id)}/reject-client`,{method:'PUT',headers});}catch(_){}currentCallbackId=null;refreshEntitlementPanel();}
  async function acceptAdminCallback(id,headers){const panel=panelContent();panel.innerHTML=panelHtml('<p><i class="fas fa-spinner fa-spin"></i> Connecting to your admin…</p>');try{const res=await fetch(`/api/calls/${encodeURIComponent(id)}/accept-client`,{method:'PUT',headers});const data=await res.json().catch(()=>({}));if(!res.ok||!data.success){currentCallbackId=null;stopClientAlert();panel.innerHTML=panelHtml(`<p style="color:#f87171;">${data.error||'Callback is no longer available.'}</p>`);return;}currentCallbackId=null;currentSessionId=id;stopClientAlert();currentPeer=new window.ManlungCallWebRTC.CallPeer({sessionId:id,isInitiator:false,headers,onStateChange:(state,detail)=>renderCallUI(state,detail),onDuration:d=>updateDuration(d)});await currentPeer.start();}catch(e){currentCallbackId=null;stopClientAlert();if(/invalid token|session (expired|revoked)/i.test(String(e.message||''))){clearInvalidClientSession();showSignInRequired();}else renderCallUI('connection-failed',e.message);}}
  function startCallbackPolling(){clearInterval(callbackPollTimer);pollForAdminCallback();callbackPollTimer=setInterval(pollForAdminCallback,2000);}
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  async function init(){if(window.__MANLUNG_CALL_WIDGET_INIT__)return;window.__MANLUNG_CALL_WIDGET_INIT__=true;buildWidget();startCallbackPolling();try{await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');}catch(e){console.warn('Supabase Realtime SDK failed to load');}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();