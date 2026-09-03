/* Manlung Recovery AI Live Bridge
 * Secure live AI connection with a local assistant fallback.
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

  function runLocalFallback(form, input, text) {
    // v2 owns the local knowledge engine. Calling its original handler keeps
    // the site useful if the server/API is temporarily unavailable.
    if (typeof form.__manlungOriginalSubmit === 'function') {
      input.value = text;
      form.__manlungOriginalSubmit({ preventDefault() {} });
      return true;
    }
    return false;
  }

  async function ask(form, input, messages, text) {
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
          body: JSON.stringify({
            message: text,
            history: history.slice(0, -1),
            pagePath: window.location.pathname
          })
        });
      } finally {
        clearTimeout(timer);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.answer) {
        throw new Error(data.code || `HTTP_${response.status}`);
      }

      document.getElementById('manlungAiLiveTyping')?.remove();
      addMessage(messages, data.answer, 'ai');
      history.push({role:'assistant', content:data.answer});
      while (history.length > MAX_HISTORY) history.shift();
    } catch (error) {
      document.getElementById('manlungAiLiveTyping')?.remove();
      console.warn('Manlung live AI unavailable:', error);

      // Never leave the user with a dead chatbot. Use the existing local
      // Manlung knowledge engine when the live service cannot be reached.
      if (runLocalFallback(form, input, text)) {
        history.pop();
        return;
      }

      addMessage(messages, 'The live AI connection is temporarily unavailable. I can still help with Manlung Recovery information, or you can use Human Support to reach an admin.', 'ai');
    }
  }

  waitForChat((form, input, messages) => {
    if (form.dataset.liveAiBound === 'true') return;

    // Capture the v2 local handler before replacing it. This is an intentional
    // resilience fallback, not a second submit handler.
    form.__manlungOriginalSubmit = form.onsubmit;
    form.dataset.liveAiBound = 'true';

    const status = document.querySelector('.manlung-ai-status');
    if (status) status.textContent = '● Live AI • Site-aware • Web connected';

    form.onsubmit = event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      ask(form, input, messages, text);
    };

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  });
})();
