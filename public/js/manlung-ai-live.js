/* Manlung Recovery AI — single submission bridge
 * One submission path only. If the live backend is unavailable, use a local
 * site-trained backup response instead of showing a dead-end error message.
 */
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
    identity: 'Manlung Recovery is a Cyber Recovery & Digital Investigation Portal. The main areas are New Recovery Request, Client Portal, Track a Case, device recovery, account recovery, scam investigation, identity-theft assistance and cybersecurity/security cases.',
    workflow: 'Start with New Recovery Request, choose the case type, enter your contact and incident details, add device information when relevant, provide useful evidence and submit. The request is reviewed and a case ID can be used to follow progress.',
    contact: 'The site lists phone +254 724 356 178 and email manlungrecovery@outlook.com. Human Support is also available through the WhatsApp option.',
    call: 'Yes. Call Admin is a real browser voice feature using WebRTC. It rings available admins and the first admin to accept gets the call. Call Admin is presented as free, but I cannot see live admin availability or guarantee an answer.',
    phone: 'For a lost or stolen phone, submit Lost Phone Recovery. Include the brand/model, colour, IMEI 1/2, serial number if available, when and where it was last seen, and useful evidence. Use official Find My/Google and carrier tools where appropriate, and do not confront a suspected thief.',
    account: 'For a hacked account, use the platform’s official recovery process, change reused passwords, enable stronger authentication, review active sessions and preserve screenshots/evidence. Manlung Recovery includes Social Media Account Recovery and Email Account Recovery.',
    scam: 'For a scam, preserve chats, screenshots, receipts, transaction references, phone numbers, usernames and links. Do not send more money to anyone promising to recover the money. The site has an Online Scam Investigation case type.',
    safety: 'Never send passwords, PINs, OTPs, recovery codes or API keys to this AI. For immediate physical danger or a theft happening now, contact appropriate local emergency services or law enforcement first.'
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function format(text) {
    return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function waitForChat(done, tries = 100) {
    const form = document.getElementById('manlungAiForm');
    const input = document.getElementById('manlungAiInput');
    const messages = document.getElementById('manlungAiMessages');
    if (form && input && messages) return done(form, input, messages);
    if (tries > 0) setTimeout(() => waitForChat(done, tries - 1), 100);
  }

  function addMessage(messages, text, who) {
    const row = document.createElement('div');
    row.className = `manlung-ai-msg ${who}`;
    const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if (who === 'ai') {
      row.innerHTML = `<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time">${time}</div></div>`;
    } else {
      row.innerHTML = `<div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time" style="text-align:right">${time}</div></div>`;
    }
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(messages) {
    if (document.getElementById('manlungAiLiveTyping')) return;
    const row = document.createElement('div');
    row.id = 'manlungAiLiveTyping';
    row.className = 'manlung-ai-msg';
    row.innerHTML = '<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>';
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() { document.getElementById('manlungAiLiveTyping')?.remove(); }

  function localReply(text) {
    const s = String(text || '').toLowerCase().replace(/[^a-z0-9+@._ -]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return 'I’m here with you. Tell me what happened and I’ll guide you.';
    if (/^(hi|hello|hey|hallo|yo|good morning|good afternoon|good evening)\b/.test(s)) return 'Hey 👋 Welcome to Manlung Recovery. Tell me what happened and I’ll guide you through the right part of the site.';
    if (s === 'eeh' || s === 'eh' || s === 'hmm' || s === 'okay' || s === 'ok') return 'Yeah 😄 I’m here. Tell me what you need help with — a stolen phone, hacked account, scam, identity theft, security issue, existing case, or contacting an admin.';
    if (s.includes('how does the site work') || s.includes('how does recovery work') || s.includes('how it works')) return LOCAL.workflow;
    if (s.includes('what can i submit') || s.includes('what services') || s.includes('case types')) return 'You can submit device recovery, online scam investigation, identity-theft assistance, social-media or email account recovery, website security incidents, malware/virus investigations, network security assessments and other cyber incidents.';
    if ((s.includes('admin') || s.includes('support')) && (s.includes('call') || s.includes('phone') || s.includes('pick') || s.includes('answer'))) return LOCAL.call;
    if (s.includes('stolen phone') || s.includes('lost phone') || s.includes('phone was stolen') || s.includes('imei')) return LOCAL.phone;
    if (s.includes('hacked') || s.includes('account hacked') || s.includes('cannot login') || s.includes('cant login') || s.includes('lost access')) return LOCAL.account;
    if (s.includes('scam') || s.includes('fraud') || s.includes('mpesa') || s.includes('m-pesa') || s.includes('stolen my money')) return LOCAL.scam;
    if (s.includes('identity theft') || s.includes('id stolen') || s.includes('sim swap')) return 'That fits Identity Theft Assistance. Secure affected bank/mobile accounts immediately, preserve evidence and use New Recovery Request for the case.';
    if (s.includes('track case') || s.includes('case status') || s.includes('case progress') || s.includes('case id')) return 'Use Track a Case or the Client Portal for an existing case. I cannot see private case status from this chat unless a real case lookup is connected.';
    if (s.includes('security') || s.includes('malware') || s.includes('virus') || s.includes('vulnerability') || s.includes('website hacked')) return 'The site supports Website Security Incident, Malware or Virus Investigation and Network Security Assessment. Tell me what you are seeing and I’ll help choose the right case type.';
    if (s.includes('human') || s.includes('admin') || s.includes('agent') || s.includes('person')) return `Of course. ${LOCAL.contact} You can also use Human Support in the chat.`;
    if (s.includes('email') || s.includes('contact') || s.includes('whatsapp') || s.includes('phone number')) return LOCAL.contact;
    if (s.includes('password') || s.includes('otp') || s.includes('pin') || s.includes('recovery code') || s.includes('secret')) return LOCAL.safety;
    if (s.includes('thank')) return 'You’re welcome 🙌 Tell me what happened and we’ll take it step by step.';
    return 'I understand. Tell me a little more about what happened, and I’ll help you choose the correct Manlung Recovery feature or next step.';
  }

  async function ask(input, messages, text) {
    const now = Date.now();
    const normalized = text.trim().toLowerCase();
    if (sending) return;
    if (normalized && normalized === lastSentText && now - lastSentAt < 1500) return;
    sending = true;
    lastSentText = normalized;
    lastSentAt = now;

    addMessage(messages, text, 'user');
    history.push({role:'user', content:text});
    while (history.length > MAX_HISTORY) history.shift();
    showTyping(messages);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50000);
      let response;
      try {
        response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'Accept':'application/json'},
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({message:text, history:history.slice(0,-1), pagePath:window.location.pathname})
        });
      } finally { clearTimeout(timer); }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.answer) throw new Error(data.code || `HTTP_${response.status}`);

      removeTyping();
      addMessage(messages, data.answer, 'ai');
      history.push({role:'assistant', content:data.answer});
      while (history.length > MAX_HISTORY) history.shift();
    } catch (error) {
      removeTyping();
      console.warn('Manlung live AI unavailable; local backup used:', error);
      history.pop();
      const backup = localReply(text);
      addMessage(messages, backup, 'ai');
      history.push({role:'assistant', content:backup});
      while (history.length > MAX_HISTORY) history.shift();
      const status = document.querySelector('.manlung-ai-status');
      if (status) status.textContent = '● Backup AI • Live connection unavailable';
    } finally {
      sending = false;
    }
  }

  waitForChat((form, input, messages) => {
    if (form.dataset.liveAiBound === 'true') return;
    form.dataset.liveAiBound = 'true';
    const status = document.querySelector('.manlung-ai-status');
    if (status) status.textContent = '● Live AI • Site-aware • Web connected';

    // CAPTURE is intentional: it runs before the legacy v2 submit listener,
    // preventing the old handler from rendering the same message twice.
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (sending) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      ask(input, messages, text);
    }, true);

    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (sending) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      ask(input, messages, text);
    }, true);
  });
})();
