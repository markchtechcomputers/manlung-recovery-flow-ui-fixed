/* Manlung Recovery AI — client support assistant.
   Front-end knowledge assistant with a polished live-chat experience.
   The secure backend is exposed at the existing /api/ai/chat path.
*/
(() => {
  'use strict';

  if (window.__MANLUNG_AI_LOADED) return;
  window.__MANLUNG_AI_LOADED = true;

  const AI_ICON = 'https://i.postimg.cc/QMcj6JDY/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png';
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
      #manlungAiRoot{display:none!important}
      .manlung-ai-pulse{animation:none}.manlung-ai-typing span{animation:none}}
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
  }
  function currentLanguage(){return localStorage.getItem('manlung-ai-language')==='sw'?'sw':'en';}
  function speak(text){if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=currentLanguage()==='sw'?'sw-KE':'en-KE';u.rate=.98;window.speechSynthesis.speak(u);}
  function injectHeaderTab(){const a=document.querySelector('.site-header .header-actions');if(!a||a.querySelector('[data-manlung-ai-tab]'))return;const b=document.createElement('button');b.type='button';b.dataset.manlungAiTab='true';b.className='manlung-ai-tab';b.textContent='Manlung AI';b.addEventListener('click',()=>toggle(true));a.insertBefore(b,a.querySelector('a[href="/client/request.html"]')||null);}

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

  async function backendReply(message){
    try{
      const history=(window.__MANLUNG_AI_HISTORY||[]).slice(-14);
      const res=await fetch('/api/ai-live/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify({message,history,language:currentLanguage(),pagePath:location.pathname})});
      if(!res.ok||!res.body)return null;
      const reader=res.body.getReader(),decoder=new TextDecoder();let buf='',answer='';
      while(true){const x=await reader.read();if(x.done)break;buf+=decoder.decode(x.value,{stream:true});const packets=buf.split('\n\n');buf=packets.pop()||'';for(const packet of packets){for(const line of packet.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;try{const obj=JSON.parse(raw);answer+=obj?.choices?.[0]?.delta?.content||obj?.choices?.[0]?.message?.content||'';}catch(_){}}}}
      return answer.trim()||null;
    }catch(_){return null;}
  }
  async function respond(displayText,forcedKey){addMessage(displayText,'user');addTyping();let reply=await backendReply(displayText);if(!reply)reply=KNOWLEDGE[forcedKey||classify(displayText)]||KNOWLEDGE.unknown;removeTyping();addMessage(reply,'ai');if(window.__MANLUNG_AI_VOICE_ON)speak(reply);}

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
