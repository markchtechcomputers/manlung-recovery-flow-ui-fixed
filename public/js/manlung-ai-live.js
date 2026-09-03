/* Manlung Recovery AI — live bridge */
(() => {
  'use strict';
  if (window.__MANLUNG_AI_LIVE_BRIDGE__) return;
  window.__MANLUNG_AI_LIVE_BRIDGE__ = true;
  const history = [];
  const MAX_HISTORY = 16;
  let sending = false;
  let lastSentText = '';
  let lastSentAt = 0;
  const LOCAL = {
    phone: 'I’m sorry your phone was stolen. Let’s handle it step by step. Lock or locate it with the official device service if enabled, contact your mobile provider if your number is at risk, preserve the IMEI/serial details and screenshots, then open New Recovery Request → Lost Phone Recovery. Don’t confront a suspected thief yourself.',
    workflow: 'Start with New Recovery Request, choose the incident type, describe what happened, add useful evidence, and submit. Keep your case ID so you can follow updates in Track a Case.',
    call: 'Yes — Call Admin is a browser voice feature using WebRTC. It can ring available admins and the first admin to accept gets the call. I can’t see live availability, so I won’t promise an answer.',
    contact: 'For human help, Manlung Recovery lists +254 724 356 178 and manlungrecovery@outlook.com. You can also use Human Support or WhatsApp on the website.',
    account: 'If an account was hacked, use the platform’s official recovery page, change the password from a trusted device, revoke unknown sessions, enable stronger sign-in protection, and preserve screenshots. Manlung Recovery supports Social Media Account Recovery and Email Account Recovery.',
    scam: 'If you were scammed, stop sending money and preserve chats, receipts, transaction references, phone numbers, usernames and links. Be careful with anyone promising guaranteed recovery. Manlung Recovery has an Online Scam Investigation case type.'
  };
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function format(text) { return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
  function waitForChat(done, tries = 100) { const form=document.getElementById('manlungAiForm'), input=document.getElementById('manlungAiInput'), messages=document.getElementById('manlungAiMessages'); if(form&&input&&messages)return done(form,input,messages); if(tries>0)setTimeout(()=>waitForChat(done,tries-1),100); }
  function addMessage(messages,text,who){const row=document.createElement('div');row.className=`manlung-ai-msg ${who}`;const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(who==='ai')row.innerHTML=`<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time">${time}</div></div>`;else row.innerHTML=`<div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time" style="text-align:right">${time}</div></div>`;messages.appendChild(row);messages.scrollTop=messages.scrollHeight;}
  function showTyping(messages){if(document.getElementById('manlungAiLiveTyping'))return;const row=document.createElement('div');row.id='manlungAiLiveTyping';row.className='manlung-ai-msg';row.innerHTML='<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>';messages.appendChild(row);messages.scrollTop=messages.scrollHeight;}
  function removeTyping(){document.getElementById('manlungAiLiveTyping')?.remove();}
  function normalizeText(text){return String(text||'').toLowerCase().replace(/[’‘]/g,"'").replace(/(.)\1{2,}/g,'$1$1').replace(/[^a-z0-9+@._ -]/g,' ').replace(/\s+/g,' ').trim();}
  function extractCaseId(text){const m=String(text||'').match(/\bMTC[-\s]?\d{4}[-\s]?\d{3}\b/i);if(!m)return null;return m[0].toUpperCase().replace(/\s+/g,'-').replace(/^MTC(?!-)/,'MTC-').replace(/MTC-(\d{4})\s*[-]?\s*(\d{3})/,'MTC-$1-$2');}
  function authHeaders(){const token=localStorage.getItem('clientToken');return token?{Authorization:`Bearer ${token}`}:{ };}
  function localReply(text){
    const s=normalizeText(text);
    if(!s)return 'I’m here. Tell me what happened and I’ll help you work out the next step.';
    if(/^(hi|hello|hey|hallo|yo|good morning|good afternoon|good evening)\b/.test(s))return 'Hey 👋 I’m Manlung Recovery AI. Tell me what happened and I’ll guide you from there.';
    if(s==='eeh'||s==='eh'||s==='hmm'||s==='okay'||s==='ok')return 'Yeah 😄 I’m here. Give me the short version of what happened and we’ll take it step by step.';
    if((/(stolen|stole|robbed|lost|missing)\b/.test(s))&&(/\b(phone|mobile|iphone|android|handset|cell)\b/.test(s)||s.includes('phhone')))return LOCAL.phone;
    if(s.includes('imei'))return LOCAL.phone;
    if(s.includes('how does the site work')||s.includes('how does recovery work')||s.includes('how it works'))return LOCAL.workflow;
    if((s.includes('admin')||s.includes('support'))&&(s.includes('call')||s.includes('phone')||s.includes('pick')||s.includes('answer')))return LOCAL.call;
    if(s.includes('hacked')||s.includes('account hacked')||s.includes('cannot login')||s.includes('cant login')||s.includes('lost access'))return LOCAL.account;
    if(s.includes('scam')||s.includes('fraud')||s.includes('mpesa')||s.includes('m-pesa')||s.includes('stolen my money'))return LOCAL.scam;
    if(s.includes('identity theft')||s.includes('id stolen')||s.includes('sim swap'))return 'That sounds like Identity Theft Assistance. Secure the affected accounts, preserve evidence, and start a New Recovery Request.';
    if(s.includes('track case')||s.includes('case status')||s.includes('case progress')||s.includes('case id')||extractCaseId(text))return 'I can help with case tracking. If you are signed in, the live connection can check your case. If not, sign in to Track a Case or the Client Portal first.';
    if(s.includes('security')||s.includes('malware')||s.includes('virus')||s.includes('vulnerability')||s.includes('website hacked'))return 'Tell me what you are seeing. Depending on the incident, Manlung Recovery supports Website Security Incident, Malware or Virus Investigation, and Network Security Assessment.';
    if(s.includes('human')||s.includes('admin')||s.includes('agent')||s.includes('person'))return LOCAL.contact;
    if(s.includes('email')||s.includes('contact')||s.includes('whatsapp')||s.includes('phone number'))return LOCAL.contact;
    if(s.includes('password')||s.includes('otp')||s.includes('pin')||s.includes('recovery code'))return 'For your security, don’t share private login or verification details in chat.';
    if(s.includes('thank'))return 'You’re welcome 🙌 Tell me what happened and we’ll work through it together.';
    return 'I can help. Tell me what happened in your own words — even if you are not sure what the problem is yet.';
  }
  async function checkBackend(status){try{const r=await fetch('/api/ai/health',{method:'GET',credentials:'same-origin',cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.ok&&d.success&&d.configured){status.textContent='● Live AI • Site-aware • Case connected';return true;}if(r.ok&&d.success&&!d.configured){status.textContent='● Backup AI • Server not configured';return false;}status.textContent='● Backup AI • API route unavailable';return false;}catch(_){status.textContent='● Backup AI • API route unavailable';return false;}}
  async function ask(input,messages,text){const now=Date.now(),normalized=text.trim().toLowerCase();if(sending)return;if(normalized&&normalized===lastSentText&&now-lastSentAt<1500)return;sending=true;lastSentText=normalized;lastSentAt=now;addMessage(messages,text,'user');history.push({role:'user',content:text});while(history.length>MAX_HISTORY)history.shift();showTyping(messages);try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),50000);let response;try{response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json',...authHeaders()},credentials:'same-origin',cache:'no-store',signal:controller.signal,body:JSON.stringify({message:text,history:history.slice(0,-1),pagePath:window.location.pathname})});}finally{clearTimeout(timer);}const data=await response.json().catch(()=>({}));if(!response.ok||!data.success||!data.answer)throw new Error(data.code||`HTTP_${response.status}`);removeTyping();addMessage(messages,data.answer,'ai');history.push({role:'assistant',content:data.answer});while(history.length>MAX_HISTORY)history.shift();const status=document.querySelector('.manlung-ai-status');if(status)status.textContent=data.caseLookup?.found?'● Live AI • Case data connected':(data.webSearchEnabled?'● Live AI • Site-aware • Web connected':'● Live AI • Site-aware');}catch(error){removeTyping();console.warn('Manlung live AI unavailable; local backup used:',error);history.pop();const backup=localReply(text);addMessage(messages,backup,'ai');history.push({role:'assistant',content:backup});while(history.length>MAX_HISTORY)history.shift();const status=document.querySelector('.manlung-ai-status');if(status)status.textContent='● Backup AI • Live connection unavailable';}finally{sending=false;}}
  waitForChat((form,input,messages)=>{if(form.dataset.liveAiBound==='true')return;form.dataset.liveAiBound='true';const status=document.querySelector('.manlung-ai-status');if(status){status.textContent='● Checking live AI…';checkBackend(status);}form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(sending)return;const text=input.value.trim();if(!text)return;input.value='';input.style.height='auto';ask(input,messages,text);},true);input.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.shiftKey)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(sending)return;const text=input.value.trim();if(!text)return;input.value='';input.style.height='auto';ask(input,messages,text);},true);});
})();
