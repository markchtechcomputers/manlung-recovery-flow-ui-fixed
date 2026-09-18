/* Manlung Recovery AI — client support assistant.
   Front-end knowledge assistant with a polished live-chat experience.
   The secure backend is exposed at the existing /api/ai/chat path.
*/
(() => {
  'use strict';

  if (window.__MANLUNG_AI_LOADED) return;
  window.__MANLUNG_AI_LOADED = true;

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
      #manlungAiRoot{position:fixed;inset:0;z-index:2147483647;pointer-events:none}
      #manlungAiWindow{position:fixed;inset:0;width:100vw;height:100dvh;display:none;flex-direction:column;background:#f7f9fc;color:#172033;overflow:hidden;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #manlungAiWindow.open{display:flex;pointer-events:auto}
      .manlung-ai-head{min-height:76px;display:flex;align-items:center;gap:14px;padding:12px 24px;background:linear-gradient(135deg,#071a33 0%,#0b3157 55%,#0b7491 100%);color:#fff;box-shadow:0 4px 18px rgba(15,23,42,.18)}
      .manlung-ai-avatar{width:48px;height:48px;display:grid;place-items:center;background:linear-gradient(135deg,#22d3ee,#2563eb);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:15px;font-size:17px;font-weight:900;letter-spacing:-.5px;box-shadow:0 8px 22px rgba(34,211,238,.25)}
      .manlung-ai-title{font-size:1.05rem;font-weight:850;letter-spacing:-.2px}
      .manlung-ai-status{margin-top:3px;color:#b9e9f5;font-size:.76rem;font-weight:650}
      .manlung-ai-status i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin-right:6px;box-shadow:0 0 10px rgba(34,197,94,.7)}
      .manlung-ai-close{margin-left:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-size:28px;line-height:1;cursor:pointer}
      .manlung-ai-close:hover{background:rgba(255,255,255,.16)}
      .manlung-ai-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 24px;background:#fff;border-bottom:1px solid #e6ebf2}
      .manlung-ai-toolbar button{border:1px solid #d7e1ec;background:#f8fafc;color:#29445f;border-radius:11px;padding:9px 13px;font-weight:800;font-size:.76rem;cursor:pointer;transition:.18s}
      .manlung-ai-toolbar button:hover{border-color:#67b9d2;background:#f1fbfd}
      .manlung-ai-body{flex:1;overflow-y:auto;padding:28px clamp(14px,5vw,90px);background:radial-gradient(circle at top,#ffffff 0%,#f7f9fc 52%,#f1f5f9 100%)}
      .manlung-ai-msg{display:flex;width:100%;margin:0 0 18px}
      .manlung-ai-msg.ai{justify-content:flex-start}.manlung-ai-msg.user{justify-content:flex-end}
      .manlung-ai-msg>div{max-width:min(760px,82%);display:flex;flex-direction:column}
      .manlung-ai-msg.ai>div{align-items:flex-start}.manlung-ai-msg.user>div{align-items:flex-end}
      .manlung-ai-bubble{padding:13px 16px;border-radius:18px;line-height:1.55;font-size:.94rem;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 2px 10px rgba(15,23,42,.06)}\n      .manlung-ai-typing{display:inline-flex;gap:5px;align-items:center;min-width:52px}.manlung-ai-typing span{width:6px;height:6px;border-radius:50%;background:#7b8da5;animation:manlungAiPulse 1.1s infinite ease-in-out}.manlung-ai-typing span:nth-child(2){animation-delay:.15s}.manlung-ai-typing span:nth-child(3){animation-delay:.3s}@keyframes manlungAiPulse{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
      .manlung-ai-msg.ai .manlung-ai-bubble{background:#fff;color:#243447;border:1px solid #e3e9f1;border-top-left-radius:6px}
      .manlung-ai-msg.user .manlung-ai-bubble{background:linear-gradient(135deg,#126f91,#2563eb);color:#fff;border:1px solid #126f91;border-top-right-radius:6px}
      .manlung-ai-time{font-size:.68rem;font-weight:700;color:#8a97a8;margin:6px 4px 0}
      .manlung-ai-msg.user .manlung-ai-time{color:#6d7c90}
      .manlung-ai-links{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
      .manlung-ai-links a{display:inline-flex;align-items:center;padding:8px 12px;border:1px solid #d7e3ed;border-radius:10px;background:#fff;color:#17617b;text-decoration:none;font-size:.74rem;font-weight:800}
      .manlung-ai-links a:hover{background:#edfafd;border-color:#7cc5d8}
      .manlung-ai-foot{padding:12px 24px 16px;background:#fff;border-top:1px solid #e4eaf1;box-shadow:0 -4px 18px rgba(15,23,42,.05)}
      .manlung-ai-compose{display:flex;align-items:flex-end;gap:9px;max-width:1000px;margin:0 auto}
      .manlung-ai-input{flex:1;min-height:46px;max-height:140px;resize:none;padding:12px 14px;border:1px solid #cbd7e5;border-radius:14px;background:#f8fafc;color:#172033;outline:none;font:inherit}
      .manlung-ai-input:focus{border-color:#39a6c3;box-shadow:0 0 0 3px rgba(57,166,195,.12);background:#fff}
      .manlung-ai-mic,.manlung-ai-send{height:48px;border:0;border-radius:14px;cursor:pointer;font-size:17px;font-weight:900;flex:0 0 48px;transition:.18s}
      .manlung-ai-mic{position:relative;background:#eef6fb;color:#12627d;border:1px solid #cfe0eb}.manlung-ai-mic.recording{background:#dc2626;color:#fff;border-color:#dc2626;box-shadow:0 0 0 5px rgba(220,38,38,.12);animation:manlungAiRecord 1s infinite}.manlung-ai-send{background:linear-gradient(135deg,#0e7490,#2563eb);color:#fff;box-shadow:0 7px 18px rgba(37,99,235,.2)}
      .manlung-ai-note{text-align:center;margin:8px auto 0;color:#8a97a8;font-size:.7rem}
      .manlung-ai-voice-state{display:none;align-items:center;justify-content:center;gap:9px;margin:0 auto 10px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:#334155;font-size:.78rem;font-weight:750;max-width:1000px}
      .manlung-ai-voice-state.show{display:flex}
      .manlung-ai-voice-dot{width:8px;height:8px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 5px rgba(37,99,235,.10)}
      .manlung-ai-voice-state.recording .manlung-ai-voice-dot{background:#dc2626;box-shadow:0 0 0 5px rgba(220,38,38,.10);animation:manlungAiVoicePulse 1s infinite}
      .manlung-ai-voice-state.processing .manlung-ai-voice-dot{background:#64748b;animation:manlungAiProcessing 1s infinite}
      @keyframes manlungAiVoicePulse{50%{transform:scale(1.35);opacity:.55}}
      @keyframes manlungAiProcessing{50%{opacity:.35;transform:scale(.75)}}
      .manlung-ai-quick{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 20px}
      .manlung-ai-quick button{border:1px solid #d7e3ed;background:#fff;color:#24516b;border-radius:999px;padding:8px 12px;font-weight:750;cursor:pointer}
      @media(max-width:650px){
        #manlungAiWindow{
          width:100vw;
          height:100dvh;
          min-height:100dvh;
          border-radius:0;
        }
        .manlung-ai-head{
          min-height:62px;
          padding:8px 10px;
          gap:10px;
          flex-shrink:0;
        }
        .manlung-ai-avatar{
          width:40px;
          height:40px;
          border-radius:12px;
          font-size:15px;
        }
        .manlung-ai-title{font-size:.98rem}
        .manlung-ai-status{font-size:.7rem}
        .manlung-ai-close{
          width:42px;
          height:42px;
          flex:0 0 42px;
          font-size:25px;
        }
        .manlung-ai-toolbar{
          padding:7px 9px;
          gap:7px;
          flex-shrink:0;
        }
        .manlung-ai-toolbar button{
          flex:1;
          min-height:42px;
          padding:8px 6px;
          font-size:.7rem;
        }
        .manlung-ai-body{
          flex:1;
          min-height:0;
          padding:14px 9px 12px;
          -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
        }
        .manlung-ai-msg{
          margin-bottom:13px;
        }
        .manlung-ai-msg>div{
          max-width:94%;
        }
        .manlung-ai-bubble{
          font-size:.9rem;
          line-height:1.5;
          padding:11px 12px;
          border-radius:16px;
        }
        .manlung-ai-quick{
          gap:6px;
          margin:2px 0 14px;
        }
        .manlung-ai-quick button{
          padding:8px 10px;
          font-size:.72rem;
          min-height:38px;
        }
        .manlung-ai-foot{
          padding:8px 9px calc(9px + env(safe-area-inset-bottom));
          flex-shrink:0;
        }
        .manlung-ai-links{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:6px;
          margin-bottom:7px;
        }
        .manlung-ai-links a{
          justify-content:center;
          text-align:center;
          padding:8px 4px;
          font-size:.66rem;
          line-height:1.15;
          min-width:0;
          min-height:38px;
        }
        .manlung-ai-voice-state{
          margin:0 auto 7px;
          padding:7px 10px;
          font-size:.7rem;
        }
        .manlung-ai-compose{
          gap:6px;
          width:100%;
        }
        .manlung-ai-input{
          min-height:46px;
          max-height:110px;
          padding:11px 12px;
          font-size:.9rem;
          border-radius:13px;
        }
        .manlung-ai-mic,
        .manlung-ai-send{
          flex:0 0 46px;
          width:46px;
          height:46px;
          border-radius:13px;
        }
        .manlung-ai-note{
          margin:5px auto 0;
          font-size:.64rem;
          line-height:1.25;
        }
      }
      html.dark #manlungAiWindow,body.dark #manlungAiWindow{background:#07111d;color:#eaf2fb}
      html.dark .manlung-ai-toolbar,body.dark .manlung-ai-toolbar{background:#0e1d2e;border-bottom-color:#29415b}
      html.dark .manlung-ai-toolbar button,body.dark .manlung-ai-toolbar button{background:#16263a;color:#dbeafe;border-color:#38516b}
      html.dark .manlung-ai-toolbar button:hover,body.dark .manlung-ai-toolbar button:hover{background:#1b334d;border-color:#4b7598}
      html.dark .manlung-ai-body,body.dark .manlung-ai-body{background:radial-gradient(circle at top,#102238 0%,#07111d 58%,#050b16 100%)}
      html.dark .manlung-ai-msg.ai .manlung-ai-bubble,body.dark .manlung-ai-msg.ai .manlung-ai-bubble{background:#102238;color:#eaf2fb;border-color:#29415b}
      html.dark .manlung-ai-msg.user .manlung-ai-bubble,body.dark .manlung-ai-msg.user .manlung-ai-bubble{background:linear-gradient(135deg,#126f91,#2563eb);color:#fff}
      html.dark .manlung-ai-time,body.dark .manlung-ai-time{color:#9eb1c6}
      html.dark .manlung-ai-msg.user .manlung-ai-time,body.dark .manlung-ai-msg.user .manlung-ai-time{color:#b8c8da}
      html.dark .manlung-ai-links a,body.dark .manlung-ai-links a{background:#102238;color:#9bd0ff;border-color:#29415b}
      html.dark .manlung-ai-links a:hover,body.dark .manlung-ai-links a:hover{background:#15304a;border-color:#4b7598}
      html.dark .manlung-ai-foot,body.dark .manlung-ai-foot{background:#0b1727;border-top-color:#29415b}
      html.dark .manlung-ai-input,body.dark .manlung-ai-input{background:#101f32;color:#eaf2fb;border-color:#38516b}
      html.dark .manlung-ai-input:focus,body.dark .manlung-ai-input:focus{background:#13263d;border-color:#39a6c3}
      html.dark .manlung-ai-mic,body.dark .manlung-ai-mic{background:#16263a;color:#9bd0ff;border-color:#38516b}
      html.dark .manlung-ai-voice-state,body.dark .manlung-ai-voice-state{background:#102238;color:#dbeafe;border-color:#29415b}
      html.dark .manlung-ai-quick button,body.dark .manlung-ai-quick button{background:#102238;color:#9bd0ff;border-color:#29415b}
      html.dark .manlung-ai-note,body.dark .manlung-ai-note{color:#9eb1c6}
      @keyframes manlungAiRecord{50%{transform:scale(1.06)}}
    `;
    document.head.appendChild(style);
  }

  function createUI(){
    if(document.getElementById('manlungAiRoot'))return;
    const root=document.createElement('div');root.id='manlungAiRoot';
    root.innerHTML=`<div id="manlungAiWindow" role="dialog" aria-modal="true" aria-label="Manlung AI" aria-hidden="true">
      <div class="manlung-ai-head"><div class="manlung-ai-avatar" aria-hidden="true">AI</div><div><div class="manlung-ai-title">Manlung AI</div><div class="manlung-ai-status"><i></i> Online • Conversational support</div></div><button type="button" class="manlung-ai-close" aria-label="Close">×</button></div>
      <div class="manlung-ai-toolbar"><button type="button" id="manlungAiLang">🌐 Auto: English</button><button type="button" id="manlungAiVoice">🔊 Voice off</button></div>
      <div class="manlung-ai-body" id="manlungAiMessages"></div>
      <div class="manlung-ai-foot"><div class="manlung-ai-links"><a href="/client/request.html">New Request</a><a href="/client/track.html">Track Case</a><a href="https://wa.me/254745682493" target="_blank" rel="noopener">Human Support</a></div>
      <div class="manlung-ai-voice-state" id="manlungAiVoiceState" aria-live="polite"><span class="manlung-ai-voice-dot"></span><span id="manlungAiVoiceStateText">Ready</span></div>
      <form class="manlung-ai-compose" id="manlungAiForm"><button class="manlung-ai-mic" id="manlungAiMic" type="button" aria-label="Start voice input" title="Speak">🎙</button><textarea class="manlung-ai-input" id="manlungAiInput" rows="1" placeholder="Message Manlung AI…"></textarea><button class="manlung-ai-send" type="submit">➤</button></form>
      <div class="manlung-ai-note">Tell me what happened in your own words. I’ll ask focused follow-up questions and guide the next step. Voice stays on until you stop it.</div></div></div>`;
    document.body.appendChild(root);bindEvents();
    addMessage(localStorage.getItem('manlung-ai-language')==='sw'?'Habari! Mimi ni Manlung AI. Naweza kukusaidia kuhusu portal, maombi ya recovery, ufuatiliaji wa kesi, au msaada wa binadamu.':'Hello! I’m Manlung AI. Ask me about the Manlung Recovery portal, requests, case tracking or support.','ai');
    addQuickReplies('greeting');
  }
  function currentLanguage(){return localStorage.getItem('manlung-ai-language')==='sw'?'sw':'en';}
  function detectLanguage(text){
    const m=String(text||'').toLowerCase();
    if(/[\u00e0\u00e8\u00ec\u00f2\u00f9]/.test(m)) return 'sw';
    const sw=/\b(habari|hujambo|mambo|nina|naweza|unaweza|nini|vipi|uko|yako|yangu|msaada|kesi|ombi|maombi|simu|imepotea|imeibiwa|akaunti|nenosiri|utafuatiliaji|fuatilia|asante|tafadhali|ndio|sawa|leo|jana|kesho|mtu|binadamu|mimi|wewe|wapi|kwa|kuhusu|nisaidie)\b/;
    const en=/\b(the|how|what|where|when|why|hello|hey|help|case|request|account|password|phone|lost|stolen|track|thanks|please|doing|can|could|would|your|you|me|my)\b/;
    const s=(m.match(sw)||[]).length,e=(m.match(en)||[]).length;
    return s>e?'sw':e>s?'en':currentLanguage();
  }
  function speechLanguage(text){return detectLanguage(text)==='sw'?'sw-KE':'en-KE';}
  function speak(text){if(!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(String(text));u.lang=speechLanguage(text);u.rate=.98;window.speechSynthesis.speak(u);}
  function createLiveSpeaker(){
    if(!('speechSynthesis'in window))return {push(){},finish(){}};
    let pending='';
    return {
      push(part){
        if(!window.__MANLUNG_AI_VOICE_ON)return;
        pending+=String(part||'');
        const m=pending.match(/^([\\s\\S]*?[.!?…](?:\\s+|$))/);
        if(m){pending=pending.slice(m[1].length);const u=new SpeechSynthesisUtterance(m[1].trim());u.lang=speechLanguage(m[1]);u.rate=.98;window.speechSynthesis.speak(u);}
      },
      finish(){
        if(!window.__MANLUNG_AI_VOICE_ON||!pending.trim())return;
        const u=new SpeechSynthesisUtterance(pending.trim());u.lang=speechLanguage(pending);u.rate=.98;window.speechSynthesis.speak(u);pending='';
      }
    };
  }
  function injectHeaderTab(){const a=document.querySelector('.site-header .header-actions');if(!a||a.querySelector('[data-manlung-ai-tab]'))return;const b=document.createElement('button');b.type='button';b.dataset.manlungAiTab='true';b.className='manlung-ai-tab';b.textContent='Manlung AI';b.addEventListener('click',()=>toggle(true));a.appendChild(b);}

  function now() { return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

  function addMessage(text, who) {
    window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY||[];
    if(who==='user') window.__MANLUNG_AI_HISTORY.push({role:'user',content:String(text)});
    else window.__MANLUNG_AI_HISTORY.push({role:'assistant',content:String(text)});
    if(window.__MANLUNG_AI_HISTORY.length>20) window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY.slice(-20);
    const body = document.getElementById('manlungAiMessages');
    if (!body) return;
    const row = document.createElement('div');
    row.className = `manlung-ai-msg ${who}`;
    const wrap=document.createElement('div');const bubble=document.createElement('div');bubble.className='manlung-ai-bubble';bubble.textContent=text;wrap.appendChild(bubble);const meta=document.createElement('div');meta.className='manlung-ai-time';meta.textContent=who==='ai'?'Manlung AI':'You';wrap.appendChild(meta);row.appendChild(wrap);body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function addTyping() {
    if(document.getElementById('manlungAiTyping')) return;
    const body = document.getElementById('manlungAiMessages');
    const row = document.createElement('div');
    row.className = 'manlung-ai-msg';
    row.id = 'manlungAiTyping';
    row.innerHTML='<div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>';
    body.appendChild(row); body.scrollTop = body.scrollHeight;
  }
  function removeTyping(){document.getElementById('manlungAiTyping')?.remove();}

  function addQuickReplies(contextKey) {
    const body = document.getElementById('manlungAiMessages');
    if (!body) return;
    document.querySelectorAll('.manlung-ai-quick').forEach(x=>x.remove());
    const wrap = document.createElement('div');
    wrap.className = 'manlung-ai-quick';
    const sets = {
      greeting:[['How it works','how'],['What can you help with?','services'],['Talk to a human','human']],
      how:[['How do I start?','process'],['What information do I need?','process'],['Talk to a human','human']],
      services:[['Device recovery','device'],['Account recovery','account'],['Scam help','scam'],['Security assessment','security']],
      device:[['I lost my phone','device'],['What should I prepare?','device'],['Start a request','request']],
      account:[['My account was hacked','account'],['What should I do first?','account'],['Start a request','request']],
      scam:[['I was scammed','scam'],['What evidence do I need?','scam'],['Start a request','request']],
      process:[['Start a new request','request'],['Track my case','track'],['Talk to a human','human']],
      contact:[['WhatsApp support','human'],['Start a request','request']],
      unknown:[['How it works','how'],['Our services','services'],['Talk to a human','human']]
    };
    (sets[contextKey]||sets.unknown).forEach(([label,key])=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=label;
      b.addEventListener('click',()=>respond(label,key));
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    body.scrollTop=body.scrollHeight;
  }

  function classify(message) {
    const m = message.toLowerCase().trim();
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

  function scrollChat(behavior='smooth'){const body=document.getElementById('manlungAiMessages');if(!body)return;requestAnimationFrame(()=>body.scrollTo({top:body.scrollHeight,behavior}));}
  function resetComposer(){const input=document.getElementById('manlungAiInput');if(input){input.value='';input.style.height='';input.placeholder='Message Manlung AI…';}}
  function addStreamingMessage(){
    const body=document.getElementById('manlungAiMessages'); if(!body)return null;
    const row=document.createElement('div');row.className='manlung-ai-msg ai';
    const wrap=document.createElement('div');const bubble=document.createElement('div');bubble.className='manlung-ai-bubble';bubble.setAttribute('aria-live','polite');wrap.appendChild(bubble);
    const meta=document.createElement('div');meta.className='manlung-ai-time';meta.textContent='Manlung AI • responding';wrap.appendChild(meta);row.appendChild(wrap);body.appendChild(row);body.scrollTop=body.scrollHeight;
    return {bubble,meta};
  }
  function appendAssistantHistory(answer){window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY||[];window.__MANLUNG_AI_HISTORY.push({role:'assistant',content:String(answer)});if(window.__MANLUNG_AI_HISTORY.length>20)window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY.slice(-20);}
  function parseAIChunk(raw){
    raw=String(raw||'').trim();if(!raw||raw==='[DONE]')return '';
    const lines=raw.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
    let out='';
    for(const line of lines){
      const value=line.startsWith('data:')?line.slice(5).trim():line;
      if(!value||value==='[DONE]')continue;
      try{
        const o=JSON.parse(value);
        const part=o?.choices?.[0]?.delta?.content||o?.choices?.[0]?.message?.content||o?.delta?.content||o?.content||o?.text||o?.response||'';
        if(part)out+=part;
      }catch(_){}
    }
    return out;
  }
  async function streamBackend(message,onText,historyOverride,languageOverride){
    let history=(historyOverride||window.__MANLUNG_AI_HISTORY||[]).slice(-14);
    if(history.length&&history[history.length-1].role==='user'&&history[history.length-1].content===message)history.pop();
    const lang=languageOverride||detectLanguage(message);
    const res=await fetch('/api/ai-live/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify({message,history,language:lang,pagePath:location.pathname})});
    if(!res.ok||!res.body)throw new Error('Live AI connection failed');
    const reader=res.body.getReader(),decoder=new TextDecoder();let buf='',answer='';
    const consume=raw=>{const part=parseAIChunk(raw);if(part){answer+=part;onText(part);}};
    while(true){
      const x=await reader.read(); if(x.done)break;
      buf+=decoder.decode(x.value,{stream:true});
      const packets=buf.split(/\n\n/);buf=packets.pop()||'';
      packets.forEach(packet=>packet.split(/\n/).forEach(line=>{if(line.startsWith('data:'))consume(line.slice(5));}));
    }
    if(buf.trim())buf.split(/\n/).forEach(line=>{if(line.startsWith('data:'))consume(line.slice(5));});
    return answer.trim();
  }
  async function respond(displayText,forcedKey){
    const message=String(displayText||'').trim();
    if(!message)return;
    const priorHistory=(window.__MANLUNG_AI_HISTORY||[]).slice(-14);
    const lang=detectLanguage(message);
    const intent=forcedKey||classify(message);
    resetComposer();addMessage(message,'user');removeTyping();scrollChat('smooth');
    const ui=addStreamingMessage();if(!ui)return;
    const speaker=createLiveSpeaker();
    let answer='';
    let failed=false;
    try{
      answer=await streamBackend(message,part=>{
        ui.bubble.textContent+=part;
        ui.meta.textContent='Manlung AI • responding…';
        speaker.push(part);
        const body=document.getElementById('manlungAiMessages');
        if(body)body.scrollTo({top:body.scrollHeight,behavior:'smooth'});
      },priorHistory,lang);
    }catch(error){
      failed=true;
      console.error('Manlung AI live response error',error);
    }
    if(!answer){
      answer=KNOWLEDGE[intent]||KNOWLEDGE.unknown;
      if(failed && intent==='unknown'){
        answer='I’m having trouble reaching the live assistant right now. You can still tell me what happened, or use New Request / Human Support below and I’ll keep the conversation focused on your next step.';
      }
    }
    ui.bubble.textContent=answer;
    ui.meta.textContent=failed?'Manlung AI • offline guidance':'Manlung AI';
    speaker.finish();
    appendAssistantHistory(answer);
    scrollChat('smooth');
    addQuickReplies(intent);
    /* Keep an explicitly-started voice session alive after each answer.
       The user controls the session with the microphone button or AI close button. */
    if(voiceSession){
      voiceAutoResume=true;
      setVoiceState('recording','Listening… speak now');
    }else{
      voiceAutoResume=false;
      setVoiceState('','');
    }
  }

  window.openManlungAI=function(open){toggle(open)};function toggle(open){const win=document.getElementById('manlungAiWindow');const next=typeof open==='boolean'?open:!win.classList.contains('open');win.classList.toggle('open',next);win.setAttribute('aria-hidden',String(!next));document.body.style.overflow=next?'hidden':'';if(next)setTimeout(()=>document.getElementById('manlungAiInput')?.focus(),80);}

  function bindEvents(){
    document.querySelector('.manlung-ai-close')?.addEventListener('click',()=>{stopListening();if('speechSynthesis'in window)window.speechSynthesis.cancel();toggle(false);});
    document.getElementById('manlungAiForm')?.addEventListener('submit',e=>{e.preventDefault();const i=document.getElementById('manlungAiInput'),v=i.value.trim();if(v){resetComposer();respond(v);}});
    document.getElementById('manlungAiInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('manlungAiForm')?.requestSubmit();}});
    document.getElementById('manlungAiLang')?.addEventListener('click',()=>{const next=currentLanguage()==='sw'?'en':'sw';localStorage.setItem('manlung-ai-language',next);const b=document.getElementById('manlungAiLang');if(b)b.textContent=next==='sw'?'🌐 Auto: Kiswahili':'🌐 Auto: English';});
    document.getElementById('manlungAiVoice')?.addEventListener('click',()=>{window.__MANLUNG_AI_VOICE_ON=!window.__MANLUNG_AI_VOICE_ON;const b=document.getElementById('manlungAiVoice');b.textContent=window.__MANLUNG_AI_VOICE_ON?'🔊 Voice on':'🔊 Voice off';if(!window.__MANLUNG_AI_VOICE_ON&&'speechSynthesis'in window)window.speechSynthesis.cancel();});
    let recognition=null,voiceSession=false,voiceAutoResume=false,voiceFinal='';
     let voiceRestartTimer=null,voiceSpeechCooldownUntil=0;
     function clearVoiceRestartTimer(){if(voiceRestartTimer){clearTimeout(voiceRestartTimer);voiceRestartTimer=null;}}
     function waitUntilSpeechIsFinished(){
       clearVoiceRestartTimer();
       const check=()=>{
         if(!voiceSession||!voiceAutoResume)return;
         if(('speechSynthesis'in window&&window.speechSynthesis.speaking)||Date.now()<voiceSpeechCooldownUntil){voiceRestartTimer=setTimeout(check,250);return;}
         voiceRestartTimer=setTimeout(()=>{voiceRestartTimer=null;if(voiceSession&&voiceAutoResume&&!recognition)startListening();},900);
       };
       check();
     }
    function setVoiceState(mode,text){
      const state=document.getElementById('manlungAiVoiceState');
      const label=document.getElementById('manlungAiVoiceStateText');
      if(!state)return;
      state.className='manlung-ai-voice-state'+(mode?' show '+mode:'');
      if(label)label.textContent=text||'Ready';
    }

    function setListening(on){
      const mic=document.getElementById('manlungAiMic'),input=document.getElementById('manlungAiInput');
      if(!mic)return;
      mic.classList.toggle('recording',on);
      mic.textContent=on?'■':'🎙';
      mic.title=on?'Listening… tap to stop':'Speak';
      mic.setAttribute('aria-label',on?'Stop listening':'Start voice input');
      if(input)input.placeholder=on?'Listening… speak now':'Message Manlung AI…';
      if(on)setVoiceState('recording','Listening… speak now');
    }
    function startListening(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR)return false;
      if(!voiceSession||!voiceAutoResume)return false;
       if(recognition||document.getElementById('manlungAiMic')?.classList.contains('recording'))return true;
       if('speechSynthesis'in window&&window.speechSynthesis.speaking){waitUntilSpeechIsFinished();return false;}
       if(Date.now()<voiceSpeechCooldownUntil){waitUntilSpeechIsFinished();return false;}
       clearVoiceRestartTimer();
      recognition=new SR();recognition.lang=currentLanguage()==='sw'?'sw-KE':'en-KE';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;voiceFinal='';
      setListening(true);
      recognition.onresult=e=>{
        voiceFinal=Array.from(e.results).map(x=>x[0].transcript).join(' ').trim();
        const input=document.getElementById('manlungAiInput');if(input){input.value=voiceFinal;input.scrollTop=input.scrollHeight;}
      };
      recognition.onend=()=>{
        const t=voiceFinal.trim();
        recognition=null;
        setListening(false);
        resetComposer();

        if(t){
          voiceAutoResume=true;
          setVoiceState('processing','Processing your message…');
          respond(t).finally(()=>{
            if(voiceSession&&voiceAutoResume){
              setVoiceState('','');
              const resumeListening=()=>{
                if(voiceSession&&voiceAutoResume&&!recognition)startListening();
              };
              waitUntilSpeechIsFinished();
            }else{
              setVoiceState('','');
            }
          });
        }else if(voiceSession&&voiceAutoResume){
          setVoiceState('','');
          waitUntilSpeechIsFinished();
        }else{
          setVoiceState('','');
        }
      };
      recognition.onerror=()=>{
        recognition=null;
        setListening(false);
        resetComposer();
        setVoiceState('','');
        if(voiceSession&&voiceAutoResume){waitUntilSpeechIsFinished();}
      };
      try{recognition.start();return true;}catch(_){recognition=null;setListening(false);return false;}
    }
    function stopListening(){
      voiceSession=false;
       voiceAutoResume=false;
       clearVoiceRestartTimer();
       if(recognition){try{recognition.stop();}catch(_){}}
       recognition=null;
       setListening(false);
      setVoiceState('','');
    }
    document.getElementById('manlungAiMic')?.addEventListener('click',()=>{
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){alert('Voice input is not supported here. Try Chrome or Edge.');return;}
      if(document.getElementById('manlungAiMic')?.classList.contains('recording')){stopListening();return;}
      window.__MANLUNG_AI_VOICE_ON=true;voiceSession=true;voiceAutoResume=true;
      const voice=document.getElementById('manlungAiVoice');if(voice)voice.textContent='🔊 Voice on';
      startListening();
    });
  }

  function boot(){injectStyles();createUI();injectHeaderTab();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
