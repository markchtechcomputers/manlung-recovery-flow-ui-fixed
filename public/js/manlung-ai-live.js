/* Manlung Recovery AI Live Bridge
 * Keeps the existing chat UI but replaces the local rule engine with the
 * secure /api/ai/chat backend. The backend supplies current site context and
 * can use web search for outside-world questions. No API key is stored here.
 */
(() => {
  'use strict';
  if (window.__MANLUNG_AI_LIVE_BRIDGE__) return;
  window.__MANLUNG_AI_LIVE_BRIDGE__ = true;

  const history = [];
  const MAX_HISTORY = 16;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function format(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
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
    if (who === 'ai') {
      row.innerHTML = `<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>`;
    } else {
      row.innerHTML = `<div><div class="manlung-ai-bubble">${format(text)}</div><div class="manlung-ai-time" style="text-align:right">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(messages) {
    const row = document.createElement('div');
    row.id = 'manlungAiLiveTyping';
    row.className = 'manlung-ai-msg';
    row.innerHTML = '<img class="manlung-ai-mini" src="https://i.postimg.cc/15BRcb9m/Chat-GPT-Image-Sep-3-2026-01-41-08-PM.png" alt="AI"><div class="manlung-ai-bubble manlung-ai-typing"><span></span><span></span><span></span></div>';
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  async function ask(messages, text) {
    addMessage(messages, text, 'user');
    history.push({role:'user', content:text});
    while (history.length > MAX_HISTORY) history.shift();
    showTyping(messages);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          message: text,
          history,
          pagePath: window.location.pathname
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Live AI unavailable');
      }
      document.getElementById('manlungAiLiveTyping')?.remove();
      addMessage(messages, data.answer, 'ai');
      history.push({role:'assistant', content:data.answer});
      while (history.length > MAX_HISTORY) history.shift();
    } catch (error) {
      document.getElementById('manlungAiLiveTyping')?.remove();
      addMessage(messages, 'I’m having trouble reaching the live AI service right now. You can still use Human Support, Call Admin, WhatsApp, phone or email from the options below.', 'ai');
    }
  }

  waitForChat((form, input, messages) => {
    if (form.dataset.liveAiBound === 'true') return;
    form.dataset.liveAiBound = 'true';

    const status = document.querySelector('.manlung-ai-status');
    if (status) status.textContent = '● Live AI • Site-aware • Web connected';

    form.onsubmit = event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      ask(messages, text);
    };

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  });
})();
