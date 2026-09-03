/* Manlung Recovery AI — client support assistant.
   Front-end knowledge assistant with a polished live-chat experience.
   A secure backend can later be connected through window.MANLUNG_AI_ENDPOINT.
*/
(() => {
  'use strict';

  if (window.__MANLUNG_AI_LOADED) return;
  window.__MANLUNG_AI_LOADED = true;

  const AI_ICON = 'https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png';
  const WHATSAPP = 'https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%20%F0%9F%91%8B%2C%20I%20came%20across%20your%20website%20and%20I%E2%80%99d%20like%20to%20get%20some%20help%20with%20my%20recovery%20request.%20Could%20you%20please%20guide%20me%20on%20what%20I%20need%20to%20do%20next%3F%20Thank%20you%21';
  const EMAIL = 'mailto:manlungrecovery@outlook.com?subject=Manlung%20Recovery%20AI%20Support';
  const REQUEST = '/client/request.html';
  const TRACK = '/client/track.html';

  const KNOWLEDGE = {
    greeting: `Hey 👋 Welcome to Manlung Recovery. I’m your AI Support Assistant. I can explain how our recovery process works, help you choose the right next step, and connect you with human support when needed. What can I help you with today?`,
    how: `Manlung Recovery starts with a structured case intake so the important details are captured. Your case is then reviewed, an investigator can be assigned, and you can follow progress using your case ID. We provide updates at meaningful stages and handle submitted case information with access controls and responsible information-handling practices.`,
    services: `Our main support areas include:\n\n• Device Recovery — guidance around lost or stolen phones, laptops, tablets and smartwatches, including GPS/IMEI tracing, carrier coordination and remote lock/wipe guidance.\n• Identity Theft — account-recovery support, documentation guidance and steps to reduce further exposure.\n• Scam Investigation — evidence collection and payment-trail tracing across banks, mobile money and crypto, plus provider/platform engagement.\n• Security Assessment — vulnerability scanning, configuration review and prioritized remediation guidance.`,
    process: `A typical case follows this flow:\n\n1. Submit a New Recovery Request.\n2. Provide accurate case details and relevant evidence.\n3. Your case is reviewed and an investigator may be assigned.\n4. You receive a case ID for tracking.\n5. Progress updates are provided at meaningful stages.\n6. Follow the recommended recovery, security or reporting steps.\n\nIf you already have a case ID, use the Track a Case page.`,
    device: `For a lost or stolen device, we can guide you through the information and steps normally needed for a recovery case, including device identifiers such as IMEI where applicable, carrier coordination, account security, remote lock/wipe options and evidence preservation. Do not attempt to confront or track a suspected thief yourself.`,
    account: `For a compromised account, the safest starting point is to secure the account through the platform’s official recovery process, change reused passwords, enable stronger authentication where available, review active sessions and preserve relevant evidence. Manlung Recovery can help organize the case and documentation.`,
    scam: `For a scam or fraud case, preserve messages, receipts, transaction references, phone numbers, usernames, URLs and other relevant evidence. Do not send additional money to someone promising to recover your money. Manlung Recovery can help structure an investigation request and guide evidence collection.`,
    security: `Security Assessment support can cover vulnerability scanning, configuration review and a prioritized remediation report for organizations. The goal is to identify weaknesses responsibly and help reduce future risk.`,
    privacy: `Client information should be handled carefully. The site describes access controls, authentication safeguards and responsible information-handling practices. Its Privacy Notice also describes personal-data processing and applicable rights and responsibilities under Kenya’s Data Protection Act, 2019 and relevant regulations.`,
    contact: `You can reach Manlung Recovery by email at manlungrecovery@outlook.com or by phone at +254 724 356 178. For a quicker support conversation, you can also use WhatsApp from the support option below.`,
    human: `Absolutely. I can hand you over to human support. Use WhatsApp for a live conversation, or email the support team. If you are ready to open a case, use the New Recovery Request button.`,
    emergency: `If you are dealing with an immediate physical safety risk, theft in progress, threats or another emergency, contact the appropriate local emergency service or law-enforcement authority first. Manlung Recovery can assist with digital recovery and investigation support, but should not replace emergency responders.`,
    unknown: `I can help with Manlung Recovery’s process, device recovery, account recovery, identity-theft support, scam investigation, security assessments, privacy, case tracking and contacting the support team.\n\nTry one of the quick options below, or tell me what happened in your own words and I’ll guide you to the next step.`
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  function format(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  function injectStyles() {
    if (document.getElementById('manlung-ai-styles')) return;
    const style = document.createElement('style');
    style.id = 'manlung-ai-styles';
    style.textContent = `
      #manlungAiRoot{position:fixed;left:18px;bottom:18px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #manlungAiButton{width:60px;height:60px;border:1px solid rgba(74,222,128,.55);border-radius:50%;padding:4px;background:linear-gradient(145deg,#07131c,#102a25);box-shadow:0 14px 40px rgba(0,0,0,.48),0 0 0 1px rgba(74,222,128,.08),0 0 24px rgba(34,197,94,.22);cursor:pointer;display:grid;place-items:center;position:relative;transition:transform .2s ease,box-shadow .2s ease}
      #manlungAiButton:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 18px 46px rgba(0,0,0,.55),0 0 28px rgba(34,197,94,.3)}
      #manlungAiButton img{width:49px;height:49px;border-radius:50%;object-fit:cover;display:block}
      .manlung-ai-pulse{position:absolute;right:-1px;top:-1px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #07131c;box-shadow:0 0 0 0 rgba(34,197,94,.65);animation:manlungAiPulse 2s infinite}
      @keyframes manlungAiPulse{70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
      #manlungAiWindow{position:absolute;left:0;bottom:74px;width:min(390px,calc(100vw - 28px));height:min(610px,calc(100vh - 105px));display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(96,165,250,.24);border-radius:22px;background:linear-gradient(160deg,rgba(7,15,27,.98),rgba(5,12,20,.98));box-shadow:0 25px 80px rgba(0,0,0,.62),0 0 50px rgba(16,185,129,.08);backdrop-filter:blur(18px)}
      #manlungAiWindow.open{display:flex;animation:manlungAiIn .22s ease both}
      @keyframes manlungAiIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
      .manlung-ai-head{min-height:74px;padding:12px 14px;display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,rgba(14,38,53,.98),rgba(10,25,37,.98));border-bottom:1px solid rgba(148,163,184,.12);position:relative}
      .manlung-ai-head:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(255,255,255,.018) 6px)}
      .manlung-ai-avatar{width:45px;height:45px;border-radius:14px;object-fit:cover;border:1px solid rgba(74,222,128,.35);box-shadow:0 0 20px rgba(34,197,94,.15)}
      .manlung-ai-title{font-weight:850;color:#f8fafc;font-size:.96rem;letter-spacing:.01em}.manlung-ai-status{font-size:.7rem;color:#86efac;margin-top:2px;display:flex;align-items:center;gap:5px}.manlung-ai-status i{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;box-shadow:0 0 8px #22c55e}
      .manlung-ai-close{margin-left:auto;z-index:2;width:34px;height:34px;border:1px solid rgba(148,163,184,.15);border-radius:10px;background:rgba(255,255,255,.04);color:#cbd5e1;cursor:pointer;font-size:1rem}.manlung-ai-close:hover{background:rgba(255,255,255,.1);color:#fff}
      .manlung-ai-body{flex:1;overflow:auto;padding:15px 13px 12px;scroll-behavior:smooth;background:radial-gradient(circle at 20% 10%,rgba(34,197,94,.045),transparent 28%),radial-gradient(circle at 90% 90%,rgba(59,130,246,.055),transparent 30%)}
      .manlung-ai-body::-webkit-scrollbar{width:5px}.manlung-ai-body::-webkit-scrollbar-thumb{background:rgba(148,163,184,.22);border-radius:9px}
      .manlung-ai-msg{display:flex;gap:8px;margin:0 0 12px;align-items:flex-end}.manlung-ai-msg.user{justify-content:flex-end}.manlung-ai-mini{width:27px;height:27px;border-radius:9px;object-fit:cover;flex:0 0 27px;border:1px solid rgba(74,222,128,.22)}
      .manlung-ai-bubble{max-width:82%;padding:10px 12px;border-radius:15px 15px 15px 4px;color:#dbeafe;background:linear-gradient(145deg,rgba(22,38,53,.96),rgba(12,27,39,.96));border:1px solid rgba(96,165,250,.13);font-size:.82rem;line-height:1.52;box-shadow:0 7px 22px rgba(0,0,0,.18)}
      .manlung-ai-msg.user .manlung-ai-bubble{border-radius:15px 15px 4px 15px;background:linear-gradient(145deg,#14532d,#166534);border-color:rgba(74,222,128,.25);color:#f0fdf4}
      .manlung-ai-time{font-size:.58rem;color:#64748b;margin:4px 2px 0}
      .manlung-ai-typing{display:inline-flex;gap:4px;padding:11px 13px}.manlung-ai-typing span{width:5px;height:5px;border-radius:50%;background:#86efac;animation:manlungDot 1s infinite}.manlung-ai-typing span:nth-child(2){animation-delay:.15s}.manlung-ai-typing span:nth-child(3){animation-delay:.3s}@keyframes manlungDot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
      .manlung-ai-quick{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 4px}.manlung-ai-quick button{border:1px solid rgba(74,222,128,.2);background:rgba(34,197,94,.055);color:#bbf7d0;border-radius:999px;padding:7px 10px;font-size:.68rem;font-weight:750;cursor:pointer}.manlung-ai-quick button:hover{background:rgba(34,197,94,.13);border-color:rgba(74,222,128,.38)}
      .manlung-ai-foot{padding:9px;border-top:1px solid rgba(148,163,184,.1);background:rgba(5,12,20,.98)}.manlung-ai-links{display:flex;gap:6px;margin-bottom:7px}.manlung-ai-links a{font-size:.62rem;color:#94a3b8;text-decoration:none;padding:4px 6px}.manlung-ai-links a:hover{color:#86efac}.manlung-ai-compose{display:flex;gap:7px;align-items:flex-end}.manlung-ai-input{flex:1;min-width:0;resize:none;max-height:92px;border:1px solid rgba(148,163,184,.18);border-radius:13px;padding:10px 11px;background:#0b1622;color:#f8fafc;outline:none;font:500 .8rem/1.35 inherit}.manlung-ai-input:focus{border-color:rgba(74,222,128,.42);box-shadow:0 0 0 3px rgba(34,197,94,.06)}.manlung-ai-send{width:42px;height:42px;border:0;border-radius:12px;background:linear-gradient(145deg,#22c55e,#15803d);color:#fff;cursor:pointer;box-shadow:0 7px 18px rgba(22,101,52,.3)}.manlung-ai-send:hover{filter:brightness(1.08)}
      .manlung-ai-note{font-size:.58rem;color:#64748b;text-align:center;margin-top:5px}
      @media(max-width:600px){#manlungAiRoot{left:12px;bottom:12px}#manlungAiButton{width:56px;height:56px}#manlungAiButton img{width:45px;height:45px}#manlungAiWindow{left:0;bottom:68px;width:calc(100vw - 24px);height:min(650px,calc(100vh - 92px));border-radius:20px}.manlung-ai-bubble{max-width:88%}}
      @media(prefers-reduced-motion:reduce){#manlungAiWindow.open{animation:none}.manlung-ai-pulse{animation:none}.manlung-ai-typing span{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (document.getElementById('manlungAiRoot')) return;
    const root = document.createElement('div');
    root.id = 'manlungAiRoot';
    root.innerHTML = `
      <div id="manlungAiWindow" role="dialog" aria-label="Manlung Recovery AI Support" aria-hidden="true">
        <div class="manlung-ai-head">
          <img class="manlung-ai-avatar" src="${AI_ICON}" alt="Manlung Recovery AI">
          <div><div class="manlung-ai-title">Manlung Recovery AI</div><div class="manlung-ai-status"><i></i> Online • Ready to help</div></div>
          <button type="button" class="manlung-ai-close" aria-label="Close AI support">×</button>
        </div>
        <div class="manlung-ai-body" id="manlungAiMessages"></div>
        <div class="manlung-ai-foot">
          <div class="manlung-ai-links"><a href="${REQUEST}">New Request</a><a href="${TRACK}">Track Case</a><a href="${WHATSAPP}" target="_blank" rel="noopener">Human Support</a></div>
          <form class="manlung-ai-compose" id="manlungAiForm"><textarea class="manlung-ai-input" id="manlungAiInput" rows="1" placeholder="Ask Manlung Recovery AI…" aria-label="Message"></textarea><button class="manlung-ai-send" type="submit" aria-label="Send message">➤</button></form>
          <div class="manlung-ai-note">AI support gives guidance — sensitive cases can be handed to human support.</div>
        </div>
      </div>
      <button type="button" id="manlungAiButton" aria-label="Open Manlung Recovery AI" title="Manlung Recovery AI"><img src="${AI_ICON}" alt=""><span class="manlung-ai-pulse"></span></button>
    `;
    document.body.appendChild(root);
    bindEvents();
    addMessage(KNOWLEDGE.greeting, 'ai');
    addQuickReplies();
  }

  function now() { return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

  function addMessage(text, who) {
    const body = document.getElementById('manlungAiMessages');
    if (!body) return;
    const row = document.createElement('div');
    row.className = `manlung-ai-msg ${who}`;
    row.innerHTML = who === 'ai'
      ? `<img class="manlung-ai-mini" src="${AI_ICON}" alt="AI"><div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time">${now()}</div></div>`
      : `<div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time" style="text-align:right">${now()}</div></div>`;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function addTyping() {
    const body = document.getElementById('manlungAiMessages');
    const row = document.createElement('div');
    row.className = 'manlung-ai-msg';
    row.id = 'manlungAiTyping';
    row.innerHTML = `<img class="manlung-ai-mini" src="${AI_ICON}" alt="AI"><div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>`;
    body.appendChild(row); body.scrollTop = body.scrollHeight;
  }
  function removeTyping(){document.getElementById('manlungAiTyping')?.remove();}

  function addQuickReplies() {
    const body = document.getElementById('manlungAiMessages');
    const wrap = document.createElement('div');
    wrap.className = 'manlung-ai-quick';
    [['How it works','how'],['Our services','services'],['Device recovery','device'],['Account recovery','account'],['Scam help','scam'],['Talk to a human','human']].forEach(([label,key])=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=label; b.addEventListener('click',()=>respond(label, key)); wrap.appendChild(b);
    });
    body.appendChild(wrap); body.scrollTop=body.scrollHeight;
  }

  function classify(message) {
    const m = message.toLowerCase();
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(m)) return 'greeting';
    if (/how.*work|works|process|procedure|steps|what do you do/.test(m)) return 'how';
    if (/service|what.*help|help.*with|offer/.test(m)) return 'services';
    if (/lost|stolen|phone|laptop|tablet|watch|imei|gps|device/.test(m)) return 'device';
    if (/account|password|gmail|facebook|instagram|whatsapp|hacked|compromised|login/.test(m)) return 'account';
    if (/scam|fraud|stole.*money|money.*stole|mpesa|m-pesa|crypto|payment|con/.test(m)) return 'scam';
    if (/security|vulnerab|assessment|audit|network/.test(m)) return 'security';
    if (/privacy|data|personal information|safe|secure/.test(m)) return 'privacy';
    if (/contact|email|phone|whatsapp|reach|human|agent|admin|investigator/.test(m)) return 'contact';
    if (/emergency|danger|threat|attack.*now|physical/.test(m)) return 'emergency';
    if (/track|case id|case number|status/.test(m)) return 'process';
    return 'unknown';
  }

  async function backendReply(message) {
    const endpoint = window.MANLUNG_AI_ENDPOINT;
    if (!endpoint) return null;
    try {
      const res = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message, page:location.pathname})});
      if (!res.ok) return null;
      const data = await res.json();
      return data.reply || data.message || null;
    } catch (_) { return null; }
  }

  async function respond(displayText, forcedKey) {
    addMessage(displayText, 'user');
    addTyping();
    const key = forcedKey || classify(displayText);
    let reply = null;
    try { reply = await backendReply(displayText); } catch (_) {}
    if (!reply) reply = KNOWLEDGE[key] || KNOWLEDGE.unknown;
    const delay = Math.min(950, Math.max(350, reply.length * 4));
    setTimeout(()=>{removeTyping();addMessage(reply,'ai');}, delay);
  }

  function toggle(open) {
    const win = document.getElementById('manlungAiWindow');
    const button = document.getElementById('manlungAiButton');
    const next = typeof open === 'boolean' ? open : !win.classList.contains('open');
    win.classList.toggle('open', next); win.setAttribute('aria-hidden', String(!next));
    if (next) setTimeout(()=>document.getElementById('manlungAiInput')?.focus(),100);
    button.setAttribute('aria-expanded', String(next));
  }

  function bindEvents() {
    document.getElementById('manlungAiButton').addEventListener('click',()=>toggle());
    document.querySelector('.manlung-ai-close').addEventListener('click',()=>toggle(false));
    document.getElementById('manlungAiForm').addEventListener('submit',e=>{e.preventDefault();const input=document.getElementById('manlungAiInput');const text=input.value.trim();if(!text)return;input.value='';input.style.height='auto';respond(text);});
    const input=document.getElementById('manlungAiInput');
    input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,92)+'px';});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('manlungAiForm').requestSubmit();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false);});
  }

  function boot(){injectStyles();createUI();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
