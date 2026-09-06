(() => {
  'use strict';

  if (!location.pathname.startsWith('/client/track.html')) return;

  const getToken = () => localStorage.getItem('clientToken') || '';
  const getCaseId = () => {
    const params = new URLSearchParams(location.search);
    return (params.get('case') || params.get('caseId') || '').trim();
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  function installStyles() {
    if (document.getElementById('manlung-client-chat-live-style')) return;
    const style = document.createElement('style');
    style.id = 'manlung-client-chat-live-style';
    style.textContent = `
      .manlung-live-chat-card{margin-top:1.1rem;overflow:hidden;border:1px solid rgba(96,165,250,.18);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.98),rgba(15,31,52,.98));box-shadow:0 14px 40px rgba(2,6,23,.18)}
      .manlung-live-chat-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.05rem;border-bottom:1px solid rgba(148,163,184,.12);background:linear-gradient(135deg,rgba(37,99,235,.16),rgba(14,165,233,.05))}
      .manlung-live-chat-title{display:flex;align-items:center;gap:.7rem;min-width:0}
      .manlung-live-chat-avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff;box-shadow:0 8px 22px rgba(37,99,235,.25)}
      .manlung-live-chat-title h3{margin:0;color:#f8fafc;font-size:1rem;line-height:1.2}
      .manlung-live-chat-title p{margin:.18rem 0 0;color:#94a3b8;font-size:.72rem}
      .manlung-live-chat-status{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .55rem;border:1px solid rgba(74,222,128,.2);border-radius:999px;background:rgba(34,197,94,.08);color:#86efac;font-size:.67rem;font-weight:800;white-space:nowrap}
      .manlung-live-chat-status i{font-size:.45rem}
      .manlung-live-chat-info{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;padding:.65rem 1.05rem;color:#94a3b8;font-size:.68rem;border-bottom:1px solid rgba(148,163,184,.08)}
      .manlung-live-chat-info span{display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .48rem;border-radius:7px;background:rgba(255,255,255,.035)}
      .manlung-live-chat-unread{margin-left:auto;color:#7dd3fc;font-weight:800}
      .manlung-live-chat-list{height:390px;overflow:auto;padding:1rem;background:radial-gradient(circle at 20% 0%,rgba(37,99,235,.08),transparent 34%),#07111f;scroll-behavior:smooth}
      .manlung-live-chat-list::-webkit-scrollbar{width:7px}.manlung-live-chat-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,.24);border-radius:999px}
      .manlung-live-chat-empty{height:100%;display:grid;place-items:center;text-align:center;color:#94a3b8;padding:2rem}
      .manlung-live-chat-empty strong{display:block;color:#e2e8f0;margin-bottom:.25rem}
      .manlung-live-bubble{max-width:min(82%,620px);margin:0 0 .75rem;padding:.72rem .82rem;border-radius:15px;border:1px solid rgba(148,163,184,.12);background:#111d2d;color:#e2e8f0;box-shadow:0 4px 14px rgba(2,6,23,.12)}
      .manlung-live-bubble.mine{margin-left:auto;background:linear-gradient(135deg,#1d4ed8,#2563eb);border-color:rgba(147,197,253,.22);border-bottom-right-radius:5px;color:#fff}
      .manlung-live-bubble:not(.mine){border-bottom-left-radius:5px}
      .manlung-live-bubble-meta{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.3rem;color:#94a3b8;font-size:.64rem;font-weight:700}
      .manlung-live-bubble.mine .manlung-live-bubble-meta{color:#dbeafe}
      .manlung-live-bubble-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;font-size:.82rem}
      .manlung-live-bubble-read{font-size:.62rem;margin-left:.2rem;color:#7dd3fc}
      .manlung-live-compose{padding:.8rem;background:#0a1727;border-top:1px solid rgba(148,163,184,.1)}
      .manlung-live-compose-row{display:flex;gap:.55rem;align-items:flex-end}
      .manlung-live-compose textarea{flex:1;min-height:52px;max-height:140px;resize:none;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:#0f1d2e;color:#f8fafc;padding:.75rem .8rem;outline:none;font:inherit;font-size:.8rem}
      .manlung-live-compose textarea:focus{border-color:rgba(96,165,250,.65);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
      .manlung-live-send{width:48px;height:48px;border:0;border-radius:13px;background:#2563eb;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 8px 20px rgba(37,99,235,.25)}
      .manlung-live-send:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
      .manlung-live-compose-note{margin-top:.45rem;color:#64748b;font-size:.64rem;display:flex;justify-content:space-between;gap:.5rem}
      .manlung-live-chat-error{margin:.55rem 1rem 0;padding:.55rem .7rem;border-radius:9px;background:rgba(239,68,68,.08);border:1px solid rgba(248,113,113,.18);color:#fca5a5;font-size:.7rem;display:none}
      @media(max-width:600px){.manlung-live-chat-head{padding:.85rem}.manlung-live-chat-info{padding:.55rem .85rem}.manlung-live-chat-list{height:55vh;min-height:300px}.manlung-live-bubble{max-width:91%}.manlung-live-compose-row{gap:.4rem}.manlung-live-send{width:46px;height:46px}}
    `;
    document.head.appendChild(style);
  }

  async function boot() {
    const caseId = getCaseId();
    if (!caseId || !getToken()) return;
    installStyles();

    const content = document.getElementById('content');
    if (!content) return;

    // Wait for the existing case renderer, then replace only its old message card.
    let attempts = 0;
    while (attempts++ < 80 && !document.querySelector('.manlung-message-card')) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    document.querySelectorAll('.manlung-message-card').forEach((node) => node.remove());
    if (document.getElementById('manlung-live-chat')) return;

    const card = document.createElement('section');
    card.id = 'manlung-live-chat';
    card.className = 'manlung-live-chat-card';
    card.innerHTML = `
      <div class="manlung-live-chat-head">
        <div class="manlung-live-chat-title">
          <div class="manlung-live-chat-avatar"><i class="fas fa-comments"></i></div>
          <div><h3>Secure Case Messages</h3><p>Direct conversation with your assigned recovery investigator</p></div>
        </div>
        <span class="manlung-live-chat-status"><i class="fas fa-circle"></i> LIVE</span>
      </div>
      <div class="manlung-live-chat-info">
        <span><i class="fas fa-shield-alt"></i> Private case channel</span>
        <span><i class="fas fa-hashtag"></i> ${escapeHtml(caseId)}</span>
        <span class="manlung-live-chat-unread" id="manlungLiveUnread"></span>
      </div>
      <div class="manlung-live-chat-list" id="manlungLiveList" aria-live="polite">
        <div class="manlung-live-chat-empty"><div><strong>Loading secure messages…</strong><span>Your conversation will appear here.</span></div></div>
      </div>
      <div class="manlung-live-chat-error" id="manlungLiveError"></div>
      <form class="manlung-live-compose" id="manlungLiveForm">
        <div class="manlung-live-compose-row">
          <textarea id="manlungLiveInput" maxlength="5000" placeholder="Write a message to your recovery investigator…" aria-label="Message"></textarea>
          <button class="manlung-live-send" id="manlungLiveSend" type="submit" aria-label="Send message" title="Send message"><i class="fas fa-paper-plane"></i></button>
        </div>
        <div class="manlung-live-compose-note"><span>Press Enter to send · Shift+Enter for a new line</span><span id="manlungLiveCount">0 / 5000</span></div>
      </form>
    `;

    content.appendChild(card);

    const list = card.querySelector('#manlungLiveList');
    const input = card.querySelector('#manlungLiveInput');
    const send = card.querySelector('#manlungLiveSend');
    const form = card.querySelector('#manlungLiveForm');
    const errorBox = card.querySelector('#manlungLiveError');
    const unreadBox = card.querySelector('#manlungLiveUnread');
    const countBox = card.querySelector('#manlungLiveCount');
    let lastSignature = '';
    let firstLoad = true;

    function showError(message) {
      errorBox.textContent = message || '';
      errorBox.style.display = message ? 'block' : 'none';
    }

    async function fetchMessages() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/messages/case/${encodeURIComponent(caseId)}?_=${Date.now()}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Unable to load messages (${res.status})`);

        const messages = Array.isArray(data.messages) ? data.messages : [];
        const signature = messages.map((m) => `${m.id}:${m.read_at || ''}`).join('|');
        if (signature !== lastSignature) {
          const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
          list.innerHTML = messages.length ? messages.map((m) => {
            const mine = String(m.sender_user_id) !== '' && String(m.sender_user_id) === 'CLIENT_SELF';
            return `<article class="manlung-live-bubble ${mine ? 'mine' : ''}" data-message-id="${escapeHtml(m.id)}" data-recipient="${escapeHtml(m.recipient_user_id)}">
              <div class="manlung-live-bubble-meta"><span>${mine ? 'You' : 'Recovery Investigator'}</span><time>${escapeHtml(formatTime(m.created_at))}</time></div>
              <div class="manlung-live-bubble-text">${escapeHtml(m.message)}</div>
            </article>`;
          }).join('') : `<div class="manlung-live-chat-empty"><div><strong>No messages yet</strong><span>Send a message below to start the conversation.</span></div></div>`;
          lastSignature = signature;
          if (firstLoad || wasNearBottom) list.scrollTop = list.scrollHeight;
        }

        // The API does not expose the current user's id in the message payload. Treat messages
        // with a non-null read_at as read and mark any unread messages addressed to the client.
        const unread = messages.filter((m) => !m.read_at && m.recipient_user_id).length;
        unreadBox.textContent = unread ? `${unread} unread` : 'All messages read';
        if (unread) {
          await Promise.all(messages.filter((m) => !m.read_at).map((m) =>
            fetch(`/api/messages/${encodeURIComponent(m.id)}/read`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
            }).catch(() => null)
          ));
          setTimeout(fetchMessages, 120);
        }
        showError('');
        firstLoad = false;
      } catch (error) {
        showError(error.message || 'Could not load the case conversation.');
      }
    }

    // Replace the temporary sender label with a client-safe rule: messages are rendered as
    // incoming unless their sender matches the id stored by the authenticated profile.
    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      send.disabled = true;
      showError('');
      try {
        const token = getToken();
        const res = await fetch(`/api/messages/case/${encodeURIComponent(caseId)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not send message.');
        input.value = '';
        countBox.textContent = '0 / 5000';
        await fetchMessages();
        list.scrollTop = list.scrollHeight;
      } catch (error) {
        showError(error.message || 'Could not send message.');
      } finally {
        send.disabled = false;
        input.focus();
      }
    }

    input.addEventListener('input', () => { countBox.textContent = `${input.value.length} / 5000`; });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', (event) => { event.preventDefault(); sendMessage(); });

    await fetchMessages();
    window.setInterval(fetchMessages, 2500);
    window.addEventListener('focus', fetchMessages);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchMessages(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
