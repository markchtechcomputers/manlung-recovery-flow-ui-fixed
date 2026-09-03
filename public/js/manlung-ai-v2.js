/* Manlung Recovery AI — site-trained conversational support assistant. */
(() => {
  'use strict';
  if (window.__MANLUNG_AI_SITE_LOADED) return;
  window.__MANLUNG_AI_SITE_LOADED = true;

  const AI_ICON='https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png';
  const WA='https://wa.me/254745682493?text=Hello%20Manlung%20Recovery%20%F0%9F%91%8B%2C%20I%20came%20across%20your%20website%20and%20I%E2%80%99d%20like%20to%20get%20some%20help%20with%20my%20recovery%20request.%20Could%20you%20please%20guide%20me%20on%20what%20I%20need%20to%20do%20next%3F%20Thank%20you%21';
  const REQUEST='/client/request.html', TRACK='/client/track.html', DASH='/client/dashboard.html', CONTACT='/contact.html';

  /* Knowledge deliberately mirrors the public Manlung Recovery site.
     The assistant must not invent guarantees, prices, capabilities or status. */
  const K={
    identity:'Manlung Recovery is a Cyber Recovery & Digital Investigation Portal. It provides structured digital recovery assistance, investigation support, account and device recovery guidance, cybersecurity awareness and secure case-management services.',
    workflow:'The normal flow is: choose New Recovery Request → select the case type → enter your contact and incident details → add device information when relevant → provide useful evidence/details → submit. The request is reviewed; an investigator may be assigned; a case ID is used for the case; progress, notifications and messages can be viewed through the client portal/track area.',
    request:'New Recovery Request is the main intake form. It asks for case type, full name, phone, email, country, county/state, town/city, preferred contact, incident description, date/time/location and optional device details such as device type, brand, model, colour, IMEI 1/2 and serial number. A draft can be restored if one was saved.',
    types:'The request form includes Lost Phone Recovery, Lost Laptop Recovery, Lost Tablet Recovery, Lost Smartwatch Recovery, Lost Vehicle GPS Investigation, Online Scam Investigation, Identity Theft Assistance, Social Media Account Recovery, Email Account Recovery, Website Security Incident, Malware or Virus Investigation, Network Security Assessment and Other Cyber Incident.',
    device:'For a lost or stolen device, useful details include the device type, brand/model, colour, IMEI and serial number when available, plus when/where it was last seen. Site guidance covers Find My/Google account history, carrier coordination, IMEI flag/block requests, remote lock/wipe guidance and police coordination where appropriate. Do not confront a suspected thief.',
    account:'For compromised email, social-media or financial accounts, use the platform’s official recovery/appeals process, change reused passwords, enable stronger authentication, review active sessions and preserve screenshots/evidence. Manlung Recovery can help organize the recovery case and documentation.',
    identityTheft:'Identity-theft support includes guidance on what to freeze or flag immediately, including bank cards, credit lines and SIM-swap protection; help compiling documentation platforms/banks may require; and referral support for an official police report where needed for insurance, disputes or credit-bureau action.',
    scam:'For online scams/fraud, preserve messages, receipts, transaction references, phone numbers, usernames, URLs and other evidence. The site describes evidence organization, payment-trail tracing across banks/mobile money/crypto, and engagement with relevant providers/platforms. Never send additional money to a person claiming they can recover your money.',
    security:'Security Assessment covers vulnerability scanning, configuration review and prioritized remediation. Website Security Incident, Malware or Virus Investigation and Network Security Assessment are available case types.',
    case:'Track Case is for an existing case. The case area can show case details, notifications, timeline/progress information and client/admin messages when available. Access to protected case information requires the authenticated client session.',
    calling:'Call Admin is a real voice-calling feature using WebRTC. The current product policy says Call Admin voice calling is free; no phone-call subscription or Paystack payment is required to place a client-to-admin call. The system rings available admins and the first admin to accept gets the call. Admin presence/busy state affects who is rung. Calls can end because an admin does not answer, permission is denied or the connection fails.',
    callLimits:'A call is not a guarantee that a human will answer immediately. The AI cannot see a human admin’s live availability. If nobody answers, use WhatsApp, phone or email for follow-up.',
    contact:'The site lists phone +254 724 356 178 and email manlungrecovery@outlook.com. WhatsApp Human Support is available from the support controls.',
    privacy:'The site says client/case information is handled with access controls, authentication safeguards and responsible information handling. Its privacy notice references Kenya’s Data Protection Act, 2019. Never send passwords, PINs, OTPs, recovery codes or other authentication secrets to the chatbot.',
    guarantee:'Recovery is not guaranteed. Outcomes depend on factors outside Manlung Recovery’s control, including third-party cooperation and the circumstances of the incident.',
    fees:'Case submission and tracking and the currently available Call Admin service are presented as free features. Do not claim a recovery-service price unless the site explicitly shows one for the user’s case.',
    prohibited:'The terms prohibit unauthorised access to another person’s account, case, device, system or data, as well as credential theft, phishing and malware distribution. The assistant should guide users toward legitimate recovery and investigation.',
    emergency:'If there is immediate physical danger, a theft is happening now, or there is a serious threat, contact appropriate local emergency services or law enforcement first. The site is for the digital recovery/investigation side.',
    handoff:'For a human, use the Human Support WhatsApp option, the listed phone number or email. The AI should never pretend to be an admin or investigator.'
  };

  const state={topic:null,device:null,account:null,caseId:null,lastUser:'',turns:0};
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9+@._ -]/g,' ').replace(/\s+/g,' ').trim();
  const has=(s,...xs)=>xs.some(x=>s.includes(x));
  const is=(s,re)=>re.test(s);

  function reply(text){
    const s=norm(text); state.lastUser=s; state.turns++;
    if(!s) return `I’m here with you. Tell me what happened, and I’ll guide you from there.`;

    if(is(s,/^(hi|hello|hey|hallo|good morning|good afternoon|good evening|yo)\b/))
      return `Hey 👋 Welcome to Manlung Recovery. You can speak normally with me. If you tell me what happened — for example a stolen phone, hacked account, scam, identity-theft problem or an existing case — I’ll guide you through the site’s process.`;

    if(has(s,'are you ai','are you human','real person','real human','who are you'))
      return `I’m the Manlung Recovery AI support assistant. I’m here to explain how the website works and help you prepare for the right next step. I’m not a human admin, so I won’t pretend to be one.`;

    if(is(s,/(pick|answer|take|receive).{0,25}(call|phone)|(call|phone).{0,25}(admin|support|team)/))
      return `Yes — the site has a real “Call Admin” voice feature. It uses WebRTC and rings available admins; the first admin to accept gets the call. The current site policy says Call Admin is free. I can’t see whether an admin is available at this exact moment, so I can’t promise someone will answer immediately. If nobody picks up, use WhatsApp, phone or email.`;

    if(has(s,'is call free','call free','pay for call','call payment','call subscription','paystack for call','400','subscription for call'))
      return `The current site policy says Call Admin voice calling is free, with no phone-call subscription or Paystack payment required to place a client-to-admin call. That is specifically about Call Admin; don’t assume other future services are free unless the site shows that.`;

    if(has(s,'how call works','how does call work','call admin work','voice call','webrtc','admin call'))
      return `Call Admin is a real browser voice call using WebRTC. When you start a call, the system checks your authenticated access and available-admin state, then rings available admins. The first admin who accepts gets the call. The call can also end if nobody answers, microphone permission is denied, or the connection fails.`;

    if(has(s,'available now','online now','admin online','is admin online','are admins online','working now','open now','hours'))
      return `I can explain how admin calling works, but I can’t see the team’s live availability from this chat. If you need a person now, try Call Admin or Human Support. If nobody answers, leave a WhatsApp, phone or email message for follow-up.`;

    if(has(s,'what is manlung','what is this site','what does manlung','what is manlung recovery','about the site'))
      return K.identity+` The main actions are New Recovery Request, Client Portal and Track a Case.`;

    if(has(s,'how do i start','where do i start','start a case','open a case','create a case','submit a request','new request','make a request','apply')){
      state.topic='request';
      return `Start with **New Recovery Request**. ${K.request} You don’t need to know the perfect category before asking me — describe your problem and I can tell you which case type fits best.`;
    }

    if(has(s,'how does recovery work','how recovery works','recovery process','process work','what happens after','steps'))
      return `Sure. ${K.workflow} If you want, tell me your incident and I’ll walk you through the form field-by-field.`;

    if(has(s,'what services','services do you offer','what can you help','what do you help','what cases','types of cases','case types'))
      return `The site supports device recovery, online-scam investigation, identity-theft assistance, social-media and email account recovery, website-security incidents, malware/virus investigations, network-security assessments and other cyber incidents. The New Request form contains the exact case-type choices.`;

    if(has(s,'phone stolen','phone was stolen','lost phone','stolen phone','lost my phone','my phone is gone','imei')){
      state.topic='device'; state.device='phone';
      return `I’m sorry that happened. For a stolen/lost phone, the site’s process is to submit a Lost Phone Recovery request and give accurate incident details. Useful information includes the phone brand/model, colour, IMEI 1/2, serial number if available, when/where it was last seen and any useful evidence. The site also describes Find My/Google history, carrier coordination, IMEI flag/block guidance and remote lock/wipe guidance. Please don’t confront the suspected thief.`;
    }

    if(has(s,'lost laptop','stolen laptop','laptop stolen','laptop missing','lost tablet','stolen tablet','tablet missing','lost smartwatch','stolen smartwatch','smartwatch missing','lost vehicle','vehicle gps')){
      state.topic='device';
      return `That fits one of the site’s device/GPS investigation categories. Start a New Recovery Request and select the matching type. Include what happened, when/where it happened and identifying details such as brand, model, serial number or other identifiers when applicable. For a vehicle GPS investigation, include the useful GPS/device and incident information you have.`;
    }

    if(has(s,'hacked','hacked account','account hacked','cannot login','cant login','lost access','password changed','whatsapp hacked','facebook hacked','instagram hacked','email hacked','gmail hacked')){
      state.topic='account';
      return `For a compromised account, start with the platform’s official recovery/appeals process and secure the account: change reused passwords, enable stronger authentication, review active sessions and preserve evidence. Manlung Recovery’s site includes Social Media Account Recovery and Email Account Recovery as case types. If you tell me which account was affected, I can give you the safest next steps.`;
    }

    if(has(s,'identity theft','someone used my id','id stolen','identity stolen','identity was stolen','sim swap','bank account opened')){
      state.topic='identity';
      return `That fits Identity Theft Assistance. The site describes help with freezing/flagging risks such as bank cards, credit lines and SIM-swap protection, compiling documentation, and referral support for an official police report where needed. If money or an account is actively being abused, contact the relevant bank/mobile provider immediately as well.`;
    }

    if(has(s,'scammed','scam','fraud','stolen my money','they took my money','mpesa scam','m-pesa scam','crypto scam','online fraud','con me')){
      state.topic='scam';
      return `That fits Online Scam Investigation. First, don’t send the scammer more money — especially to someone promising “recovery.” Preserve screenshots, chats, receipts, transaction references, phone numbers, usernames and links. The site describes evidence organization, payment-trail tracing across banks/mobile money/crypto and engagement with relevant providers/platforms. If you tell me what happened and how the payment was made, I can help you organize the information for the request.`;
    }

    if(has(s,'security assessment','cybersecurity','security audit','vulnerability','network security','malware','virus','website hacked','website security'))
      return `The site has security-focused case types including Website Security Incident, Malware or Virus Investigation and Network Security Assessment. Its Security Assessment description covers vulnerability scanning, configuration review and prioritized remediation. Tell me what you’re seeing and I’ll help you identify the appropriate request type.`;

    if(has(s,'track case','track my case','case status','case progress','where is my case','case number','case id','my case')){
      state.topic='case';
      return `If you already have a case ID, use **Track a Case** or the Client Portal. The case area can show case details, notifications, timeline/progress information and messages when available. If you give me the general issue (without passwords or codes), I can explain what to expect from the tracking page.`;
    }

    if(has(s,'dashboard','client portal','my account','sign in','login'))
      return `The **Client Portal** is where an authenticated client can manage/view their recovery activity. **Track a Case** is used for an existing case, while **New Recovery Request** is used to start a new incident report.`;

    if(has(s,'what information','what do i need','documents needed','evidence','what should i submit','what details')){
      return `Give the site accurate information about who you are, how to contact you, what happened, when/where it happened, and useful identifiers/evidence relevant to the incident. For devices that can include brand/model, colour, IMEI and serial number. For scams, keep transaction references, receipts, messages and links. For account compromise, preserve screenshots and relevant account evidence. Never send me passwords, PINs, OTPs or recovery codes.`;
    }

    if(has(s,'fee','fees','cost','price','how much','pay','payment'))
      return K.fees+` Recovery outcomes are not guaranteed. If the site presents a specific charge for a particular service, rely on that current page rather than anything I guess.`;

    if(has(s,'guarantee','will you recover','can you guarantee','100 percent','100%','definitely recover'))
      return `I want to be clear about that: ${K.guarantee}`;

    if(has(s,'safe','privacy','personal data','my data','data protection','is my information safe'))
      return K.privacy;

    if(has(s,'password','pin','otp','verification code','recovery code','secret'))
      return `Please don’t send passwords, PINs, OTPs, recovery codes or authentication secrets here. If you’re describing an account problem, tell me what happened without revealing the secret itself, and I’ll guide you safely.`;

    if(has(s,'admin','human','agent','investigator','person','talk to someone','speak to someone','contact support'))
      return `Of course. ${K.handoff} I can also help you write a clear message describing your issue before you contact them.`;

    if(has(s,'email address','email','phone number','contact number','whatsapp number','contact you','reach you'))
      return `${K.contact} For the fastest handoff, use the Human Support WhatsApp option in this chat.`;

    if(has(s,'emergency','danger','threat','being attacked','robbery now','theft happening now'))
      return K.emergency;

    if(has(s,'thank','thanks','thank you','appreciate'))
      return `You’re welcome 🙌. Tell me what happened whenever you’re ready, and we’ll take it one step at a time.`;

    /* Contextual follow-up handling: short replies become meaningful after a topic. */
    if(state.topic==='device' && is(s,/^(yes|no|okay|ok|phone|laptop|tablet|watch)$/))
      return `Got it. For the request, the most useful next step is to record the incident details and the device identifiers you have. If you tell me what information you already have, I can tell you what to put in each part of the form.`;
    if(state.topic==='scam' && is(s,/^(mpesa|m pesa|bank|crypto|cash|card|yes|no)$/))
      return `Thanks — that helps identify the evidence to preserve. Keep the transaction/reference number, exact amount, date/time, recipient details and screenshots/messages. Then submit an Online Scam Investigation request.`;
    if(state.topic==='account' && is(s,/^(whatsapp|facebook|instagram|gmail|email|bank|yes|no)$/))
      return `Understood. Use the platform’s official recovery process first, then secure reused passwords and active sessions. Manlung Recovery can help with the investigation/recovery-support side through a Social Media Account Recovery or Email Account Recovery request, depending on the account.`;

    return `I can help with the Manlung Recovery website, but I don’t want to guess and give you a false answer. Tell me what you’re trying to do — **start a recovery request, track a case, use Call Admin, recover a device/account, investigate a scam, handle identity theft, or get human support** — and I’ll guide you.`;
  }

  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  const time=()=>new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

  function css(){
    if(document.getElementById('manlung-ai-site-style'))return;
    const s=document.createElement('style'); s.id='manlung-ai-site-style'; s.textContent=`#manlungAiRoot{position:fixed;left:18px;bottom:18px;z-index:2147483000;font-family:Inter,system-ui,sans-serif}#manlungAiButton{width:60px;height:60px;border:1px solid rgba(74,222,128,.55);border-radius:50%;padding:4px;background:linear-gradient(145deg,#07131c,#102a25);box-shadow:0 14px 40px rgba(0,0,0,.48),0 0 24px rgba(34,197,94,.22);cursor:pointer;display:grid;place-items:center;position:relative}#manlungAiButton img{width:49px;height:49px;border-radius:50%;object-fit:cover}.manlung-ai-pulse{position:absolute;right:-1px;top:-1px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #07131c}#manlungAiWindow{position:absolute;left:0;bottom:74px;width:min(400px,calc(100vw - 28px));height:min(630px,calc(100vh - 105px));display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(96,165,250,.24);border-radius:22px;background:linear-gradient(160deg,rgba(7,15,27,.99),rgba(5,12,20,.99));box-shadow:0 25px 80px rgba(0,0,0,.62),0 0 50px rgba(16,185,129,.08)}#manlungAiWindow.open{display:flex;animation:aiin .22s ease both}@keyframes aiin{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}.manlung-ai-head{min-height:74px;padding:12px 14px;display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#0e2635,#0a1925);border-bottom:1px solid rgba(148,163,184,.12)}.manlung-ai-avatar{width:45px;height:45px;border-radius:14px;object-fit:cover;border:1px solid rgba(74,222,128,.35)}.manlung-ai-title{font-weight:850;color:#f8fafc;font-size:.96rem}.manlung-ai-status{font-size:.7rem;color:#86efac;margin-top:2px}.manlung-ai-close{margin-left:auto;width:34px;height:34px;border:1px solid rgba(148,163,184,.15);border-radius:10px;background:rgba(255,255,255,.04);color:#cbd5e1;cursor:pointer;font-size:1rem}.manlung-ai-body{flex:1;overflow:auto;padding:15px 13px 12px}.manlung-ai-msg{display:flex;gap:8px;margin:0 0 12px;align-items:flex-end}.manlung-ai-msg.user{justify-content:flex-end}.manlung-ai-mini{width:27px;height:27px;border-radius:9px;object-fit:cover;flex:0 0 27px}.manlung-ai-bubble{max-width:84%;padding:10px 12px;border-radius:15px 15px 15px 4px;color:#dbeafe;background:linear-gradient(145deg,#162635,#0c1b27);border:1px solid rgba(96,165,250,.13);font-size:.82rem;line-height:1.55;box-shadow:0 7px 22px rgba(0,0,0,.18)}.manlung-ai-msg.user .manlung-ai-bubble{border-radius:15px 15px 4px 15px;background:linear-gradient(145deg,#14532d,#166534);color:#f0fdf4}.manlung-ai-time{font-size:.58rem;color:#64748b;margin:4px 2px}.manlung-ai-typing{display:inline-flex;gap:4px}.manlung-ai-typing span{width:5px;height:5px;border-radius:50%;background:#86efac;animation:dot 1s infinite}.manlung-ai-typing span:nth-child(2){animation-delay:.15s}.manlung-ai-typing span:nth-child(3){animation-delay:.3s}@keyframes dot{30%{opacity:1;transform:translateY(-3px)}100%{opacity:.25}}.manlung-ai-quick{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 10px}.manlung-ai-quick button{border:1px solid rgba(74,222,128,.2);background:rgba(34,197,94,.055);color:#bbf7d0;border-radius:999px;padding:7px 10px;font-size:.68rem;font-weight:750;cursor:pointer}.manlung-ai-foot{padding:9px;border-top:1px solid rgba(148,163,184,.1);background:#050c14}.manlung-ai-links{display:flex;gap:6px;margin-bottom:7px;flex-wrap:wrap}.manlung-ai-links a{font-size:.62rem;color:#94a3b8;text-decoration:none;padding:4px 6px}.manlung-ai-compose{display:flex;gap:7px}.manlung-ai-input{flex:1;resize:none;max-height:92px;border:1px solid rgba(148,163,184,.18);border-radius:13px;padding:10px 11px;background:#0b1622;color:#f8fafc;outline:none;font:500 .8rem/1.35 inherit}.manlung-ai-send{width:42px;height:42px;border:0;border-radius:12px;background:linear-gradient(145deg,#22c55e,#15803d);color:#fff;cursor:pointer}@media(max-width:600px){#manlungAiRoot{left:12px;bottom:12px}#manlungAiButton{width:56px;height:56px}#manlungAiButton img{width:45px;height:45px}#manlungAiWindow{bottom:68px;width:calc(100vw - 24px);height:min(670px,calc(100vh - 92px))}.manlung-ai-bubble{max-width:90%}}`; document.head.appendChild(s);
  }

  function add(text,who){
    const b=document.getElementById('manlungAiMessages'); if(!b)return;
    const r=document.createElement('div'); r.className='manlung-ai-msg '+who;
    r.innerHTML=who==='ai'?`<img class="manlung-ai-mini" src="${AI_ICON}" alt="AI"><div><div class="manlung-ai-bubble">${esc(text).replace(/\n/g,'<br>')}</div><div class="manlung-ai-time">${time()}</div></div>`:`<div><div class="manlung-ai-bubble">${esc(text)}</div><div class="manlung-ai-time" style="text-align:right">${time()}</div></div>`;
    b.appendChild(r); b.scrollTop=b.scrollHeight;
  }
  function typing(){const b=document.getElementById('manlungAiMessages');const r=document.createElement('div');r.id='manlungAiTyping';r.className='manlung-ai-msg';r.innerHTML=`<img class="manlung-ai-mini" src="${AI_ICON}" alt="AI"><div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>`;b.appendChild(r);b.scrollTop=b.scrollHeight;}
  function ask(text){add(text,'user');typing();setTimeout(()=>{document.getElementById('manlungAiTyping')?.remove();add(reply(text),'ai');},Math.min(1250,430+String(text).length*6));}
  function quick(){const b=document.getElementById('manlungAiMessages'),w=document.createElement('div');w.className='manlung-ai-quick';[['How does the site work?','How does the recovery process work?'],['What can I submit?','What information do I need to submit?'],['Do admins pick calls?','Do admins pick calls?'],['My phone was stolen','My phone was stolen'],['My account was hacked','My account was hacked'],['I need a human','I need a human']].forEach(([label,text])=>{const q=document.createElement('button');q.type='button';q.textContent=label;q.onclick=()=>{w.remove();ask(text)};w.appendChild(q)});b.appendChild(w);}

  function ui(){
    css(); if(document.getElementById('manlungAiRoot'))return;
    const root=document.createElement('div');root.id='manlungAiRoot';
    root.innerHTML=`<div id="manlungAiWindow" role="dialog" aria-label="Manlung Recovery AI Support" aria-hidden="true"><div class="manlung-ai-head"><img class="manlung-ai-avatar" src="${AI_ICON}" alt="Manlung Recovery AI"><div><div class="manlung-ai-title">Manlung Recovery AI</div><div class="manlung-ai-status">● Online • Ready to help</div></div><button class="manlung-ai-close" type="button" aria-label="Close">×</button></div><div class="manlung-ai-body" id="manlungAiMessages"></div><div class="manlung-ai-foot"><div class="manlung-ai-links"><a href="${REQUEST}">New Request</a><a href="${TRACK}">Track Case</a><a href="${DASH}">Client Portal</a><a href="${CONTACT}">Contact</a><a href="${WA}" target="_blank" rel="noopener">Human Support</a></div><form class="manlung-ai-compose" id="manlungAiForm"><textarea class="manlung-ai-input" id="manlungAiInput" rows="1" placeholder="Talk to me…"></textarea><button class="manlung-ai-send" type="submit" aria-label="Send">➤</button></form></div></div><button id="manlungAiButton" type="button" aria-label="Open Manlung Recovery AI"><img src="${AI_ICON}" alt="AI"><span class="manlung-ai-pulse"></span></button>`;
    document.body.appendChild(root);
    const win=root.querySelector('#manlungAiWindow'),btn=root.querySelector('#manlungAiButton'),close=root.querySelector('.manlung-ai-close'),form=root.querySelector('#manlungAiForm'),input=root.querySelector('#manlungAiInput');
    const open=()=>{win.classList.add('open');win.setAttribute('aria-hidden','false');if(!document.getElementById('manlungAiMessages').children.length){add(`Hey 👋 I’m the Manlung Recovery AI assistant. I’m trained on how this website works — requests, case tracking, device/account recovery, scams, identity theft, security cases and Call Admin. Ask me anything about the site.`, 'ai');quick();}setTimeout(()=>input.focus(),80)};
    const shut=()=>{win.classList.remove('open');win.setAttribute('aria-hidden','true')};
    btn.onclick=()=>win.classList.contains('open')?shut():open();close.onclick=shut;
    form.onsubmit=e=>{e.preventDefault();const t=input.value.trim();if(!t)return;input.value='';input.style.height='auto';ask(t)};
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);else ui();
})();