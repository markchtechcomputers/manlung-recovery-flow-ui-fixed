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
      .manlung-ai-toolbar{display:flex;justify-content:flex-end;gap:8px;padding:10px 24px;background:#fff;border-bottom:1px solid #e6ebf2}
      .manlung-ai-toolbar button{border:1px solid #d9e2ef;background:#fff;color:#24405f;border-radius:10px;padding:8px 12px;font-weight:750;font-size:.75rem;cursor:pointer}
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
      .manlung-ai-mic,.manlung-ai-send{width:46px;height:46px;border:0;border-radius:14px;cursor:pointer;font-size:18px;font-weight:900}
      .manlung-ai-mic{background:#e8f7fb;color:#12627d}.manlung-ai-send{background:linear-gradient(135deg,#0e7490,#2563eb);color:#fff;box-shadow:0 7px 18px rgba(37,99,235,.2)}
      .manlung-ai-note{text-align:center;margin:8px auto 0;color:#8a97a8;font-size:.7rem}
      .manlung-ai-quick{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 20px}
      .manlung-ai-quick button{border:1px solid #d7e3ed;background:#fff;color:#24516b;border-radius:999px;padding:8px 12px;font-weight:750;cursor:pointer}
      @media(max-width:650px){
        .manlung-ai-head{min-height:68px;padding:10px 14px}.manlung-ai-avatar{width:42px;height:42px;border-radius:13px}.manlung-ai-close{width:40px;height:40px}
        .manlung-ai-toolbar{justify-content:stretch;padding:8px 12px}.manlung-ai-toolbar button{flex:1}
        .manlung-ai-body{padding:18px 12px}.manlung-ai-msg>div{max-width:90%}.manlung-ai-bubble{font-size:.9rem;padding:11px 13px}
        .manlung-ai-foot{padding:9px 10px 12px}.manlung-ai-links{overflow-x:auto;flex-wrap:nowrap}.manlung-ai-links a{white-space:nowrap}
      }
    `;
    document.head.appendChild(style);
  }

  function createUI(){
    if(document.getElementById('manlungAiRoot'))return;
    const root=document.createElement('div');root.id='manlungAiRoot';
    root.innerHTML=`<div id="manlungAiWindow" role="dialog" aria-modal="true" aria-label="Manlung AI" aria-hidden="true">
      <div class="manlung-ai-head"><div class="manlung-ai-avatar" aria-hidden="true">AI</div><div><div class="manlung-ai-title">Manlung AI</div><div class="manlung-ai-status"><i></i> Online • Fast support</div></div><button type="button" class="manlung-ai-close" aria-label="Close">×</button></div>
      <div class="manlung-ai-toolbar"><button type="button" id="manlungAiLang">English / Kiswahili</button><button type="button" id="manlungAiVoice">🔊 Voice off</button></div>
      <div class="manlung-ai-body" id="manlungAiMessages"></div>
      <div class="manlung-ai-foot"><div class="manlung-ai-links"><a href="/client/request.html">New Request</a><a href="/client/track.html">Track Case</a><a href="https://wa.me/254745682493" target="_blank" rel="noopener">Human Support</a></div>
      <form class="manlung-ai-compose" id="manlungAiForm"><button class="manlung-ai-mic" id="manlungAiMic" type="button">🎙</button><textarea class="manlung-ai-input" id="manlungAiInput" rows="1" placeholder="Message Manlung AI…"></textarea><button class="manlung-ai-send" type="submit">➤</button></form>
      <div class="manlung-ai-note">Speak naturally, switch English/Kiswahili, or type your message.</div></div></div>`;
    document.body.appendChild(root);bindEvents();
    addMessage(localStorage.getItem('manlung-ai-language')==='sw'?'Habari! Mimi ni Manlung AI. Naweza kukusaidia kuhusu portal, maombi ya recovery, ufuatiliaji wa kesi, au msaada wa binadamu.':'Hello! I’m Manlung AI. Ask me about the Manlung Recovery portal, requests, case tracking or support.','ai');
    addQuickReplies();
  }
  function currentLanguage(){return localStorage.getItem('manlung-ai-language')==='sw'?'sw':'en';}
  function speak(text){if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=currentLanguage()==='sw'?'sw-KE':'en-KE';u.rate=.98;window.speechSynthesis.speak(u);}
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

  function addStreamingMessage(){
    const body=document.getElementById('manlungAiMessages'); if(!body)return null;
    const row=document.createElement('div');row.className='manlung-ai-msg ai';
    const wrap=document.createElement('div');const bubble=document.createElement('div');bubble.className='manlung-ai-bubble';wrap.appendChild(bubble);
    const meta=document.createElement('div');meta.className='manlung-ai-time';meta.textContent='Manlung AI • responding';wrap.appendChild(meta);row.appendChild(wrap);body.appendChild(row);body.scrollTop=body.scrollHeight;
    return {bubble,meta};
  }
  function appendAssistantHistory(answer){window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY||[];window.__MANLUNG_AI_HISTORY.push({role:'assistant',content:String(answer)});if(window.__MANLUNG_AI_HISTORY.length>20)window.__MANLUNG_AI_HISTORY=window.__MANLUNG_AI_HISTORY.slice(-20);}
  function parseAIChunk(raw){
    raw=String(raw||'').trim();if(!raw||raw==='[DONE]')return '';
    try{const o=JSON.parse(raw);return o?.choices?.[0]?.delta?.content||o?.choices?.[0]?.message?.content||o?.delta?.content||o?.content||o?.text||'';}catch(_){return raw;}
  }
  async function streamBackend(message,onText){
    const history=(window.__MANLUNG_AI_HISTORY||[]).slice(-14);
    const res=await fetch('/api/ai-live/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify({message,history,language:currentLanguage(),pagePath:location.pathname})});
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
    addMessage(displayText,'user');removeTyping();
    const ui=addStreamingMessage();let answer='';
    try{
      answer=await streamBackend(displayText,part=>{ui.bubble.textContent+=part;ui.meta.textContent='Manlung AI • responding';document.getElementById('manlungAiMessages').scrollTop=999999;});
    }catch(_){}
    if(!answer)answer=KNOWLEDGE[forcedKey||classify(displayText)]||KNOWLEDGE.unknown;
    ui.bubble.textContent=answer;ui.meta.textContent='Manlung AI';
    appendAssistantHistory(answer);
    if(window.__MANLUNG_AI_VOICE_ON)speak(answer);
  }

  function toggle(open){const win=document.getElementById('manlungAiWindow');const next=typeof open==='boolean'?open:!win.classList.contains('open');win.classList.toggle('open',next);win.setAttribute('aria-hidden',String(!next));document.body.style.overflow=next?'hidden':'';if(next)setTimeout(()=>document.getElementById('manlungAiInput')?.focus(),80);}

  function bindEvents(){
    document.querySelector('.manlung-ai-close')?.addEventListener('click',()=>toggle(false));
    document.getElementById('manlungAiForm')?.addEventListener('submit',e=>{e.preventDefault();const i=document.getElementById('manlungAiInput'),v=i.value.trim();if(v){i.value='';respond(v);}});
    document.getElementById('manlungAiLang')?.addEventListener('click',()=>{localStorage.setItem('manlung-ai-language',currentLanguage()==='sw'?'en':'sw');location.reload();});
    document.getElementById('manlungAiVoice')?.addEventListener('click',()=>{window.__MANLUNG_AI_VOICE_ON=!window.__MANLUNG_AI_VOICE_ON;document.getElementById('manlungAiVoice').textContent=window.__MANLUNG_AI_VOICE_ON?'🔊 Voice on':'🔊 Voice off';});
    document.getElementById('manlungAiMic')?.addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Voice input is not supported here. Try Chrome or Edge.');return;}const r=new SR();r.lang=currentLanguage()==='sw'?'sw-KE':'en-KE';r.interimResults=false;r.onresult=e=>{const t=e.results[0][0].transcript.trim();if(t){document.getElementById('manlungAiInput').value=t;respond(t);}};r.start();});
  }

  function boot(){injectStyles();createUI();injectHeaderTab();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
