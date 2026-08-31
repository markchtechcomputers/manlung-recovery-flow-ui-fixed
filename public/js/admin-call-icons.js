/* Admin Call UI enhancement: show the client profile icon on incoming/active calls. */
(function () {
  const CLIENT_ICON = 'https://i.postimg.cc/RFfNLMXT/Chat-GPT-Image-Aug-31-2026-11-16-19-AM.png';

  function addClientAvatar() {
    if (!location.pathname.startsWith('/admin/')) return;

    const body = document.getElementById('callModalBody');
    if (!body || !body.isConnected) return;
    if (body.querySelector('[data-manlung-client-avatar="true"]')) return;

    const text = (body.textContent || '').toLowerCase();
    const isCallState =
      text.includes('incoming help call') ||
      text.includes('connected to client') ||
      text.includes('connecting securely') ||
      text.includes('requesting microphone access');

    if (!isCallState) return;

    const avatar = document.createElement('div');
    avatar.dataset.manlungClientAvatar = 'true';
    avatar.style.cssText = [
      'width:72px',
      'height:72px',
      'margin:0 auto .8rem',
      'border-radius:50%',
      'overflow:hidden',
      'position:relative',
      'border:3px solid rgba(96,165,250,.9)',
      'box-shadow:0 0 0 5px rgba(96,165,250,.10),0 8px 25px rgba(0,0,0,.30)',
      'background:#16345f',
      'animation:manlungAdminClientPulse 1.4s ease-in-out infinite'
    ].join(';');

    const img = document.createElement('img');
    img.src = CLIENT_ICON;
    img.alt = 'Client';
    img.loading = 'eager';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.onerror = function () {
      this.style.display = 'none';
      avatar.innerHTML += '<i class="fas fa-user" aria-hidden="true" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;"></i>';
    };

    avatar.appendChild(img);
    body.insertBefore(avatar, body.firstChild);
  }

  function install() {
    if (!location.pathname.startsWith('/admin/')) return;

    if (!document.getElementById('manlung-admin-client-avatar-style')) {
      const style = document.createElement('style');
      style.id = 'manlung-admin-client-avatar-style';
      style.textContent = '@keyframes manlungAdminClientPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}';
      document.head.appendChild(style);
    }

    addClientAvatar();

    const observer = new MutationObserver(addClientAvatar);
    observer.observe(document.body, { childList: true, subtree: true });

    window.setTimeout(addClientAvatar, 250);
    window.setTimeout(addClientAvatar, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();