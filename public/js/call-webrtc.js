/* Reliable WebRTC audio calling.
   SDP/ICE signaling is persisted through authenticated API endpoints so
   calls do not depend on Supabase Realtime timing or browser broadcast state.
   TURN is supplied by the server for networks where direct P2P is blocked. */
(function () {
  let publicConfigCache = null;
  const RINGTONE_OPTIONS = [{id:'soft-bell',name:'Soft Bell',notes:[659.25,783.99]},{id:'gentle-chime',name:'Gentle Chime',notes:[523.25,659.25,783.99]},{id:'sweet-pulse',name:'Sweet Pulse',notes:[587.33,698.46]},{id:'calm-tone',name:'Calm Tone',notes:[440,554.37,659.25]},{id:'bright-call',name:'Bright Call',notes:[659.25,880]}];
  let ringtoneContext=null, ringtoneTimer=null;
  function selectedRingtone(){return localStorage.getItem('manlungRingtone')||'soft-bell';}
  function playRingtone(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!ringtoneContext)ringtoneContext=new A();const o=RINGTONE_OPTIONS.find(x=>x.id===selectedRingtone())||RINGTONE_OPTIONS[0];o.notes.forEach((f,i)=>{const x=ringtoneContext.createOscillator(),g=ringtoneContext.createGain(),t=ringtoneContext.currentTime+i*.12;x.type='sine';x.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.06,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.4);x.connect(g);g.connect(ringtoneContext.destination);x.start(t);x.stop(t+.45);});}catch(_){} }
  function startRingtone(){stopRingtone();playRingtone();ringtoneTimer=setInterval(playRingtone,2600);}
  function stopRingtone(){if(ringtoneTimer)clearInterval(ringtoneTimer);ringtoneTimer=null;}
  window.ManlungCallRingtone={start:startRingtone,stop:stopRingtone,options:RINGTONE_OPTIONS,set:id=>{if(RINGTONE_OPTIONS.some(x=>x.id===id))localStorage.setItem('manlungRingtone',id);},get:selectedRingtone};


  async function getPublicConfig() {
    if (!publicConfigCache) {
      const res = await fetch('/api/config/public', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load public configuration.');
      publicConfigCache = await res.json();
    }
    return publicConfigCache;
  }

  async function getIceServers(headers) {
    try {
      const res = await fetch('/api/calls/ice-servers', {
        headers: headers || {},
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.iceServers) && data.iceServers.length) {
        return data.iceServers;
      }
    } catch (_) {}
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function currentUserIdFromHeaders(headers) {
    try {
      const auth = headers?.Authorization || headers?.authorization || '';
      const token = String(auth).replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;
      const part = token.split('.')[1];
      if (!part) return null;
      const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload.id || payload.sub || null;
    } catch (_) {
      return null;
    }
  }

  async function getSessionIdentity(sessionId, headers, isInitiator) {
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(sessionId)}`, {
        headers: headers || {},
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      const session = data?.session;
      if (!session) return null;
      return isInitiator ? (session.client_user_id || null) : (session.admin_user_id || null);
    } catch (_) {
      return null;
    }
  }

  class CallPeer {
    constructor({ sessionId, isInitiator, headers, onStateChange, onDuration }) {
      this.sessionId = sessionId;
      this.isInitiator = !!isInitiator;
      this.headers = headers || {};
      // Determine the signaling identity from the token actually used by this
      // CallPeer instance. Do not read clientToken/adminToken globally: an
      // admin browser can retain both tokens (for example after testing both
      // portals), which can cause the admin to mistake the client's offer for
      // its own and silently skip it.
      this.currentUserId = currentUserIdFromHeaders(this.headers);
      this.onStateChange = onStateChange || (() => {});
      this.onDuration = onDuration || (() => {});
      this.pc = null;
      this.localStream = null;
      this.connectedAt = null;
      this.durationTimer = null;
      this.connectionTimeout = null;
      this.ended = false;
      this.remoteDescriptionSet = false;
      this.pendingIce = [];
      this.remoteAudio = null;
      this.signalCursor = 0;
      this.signalTimer = null;
      this.offerSent = false;
      this.answerSent = false;
      this.endSent = false;
      this.remoteEndSeen = false;
      this.connectionTimeout = null;
    }

    setState(state, extra) {
      try { this.onStateChange(state, extra); } catch (_) {}
    }

    async start() {
      if (this.ended) throw new Error('Call has already ended.');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support microphone calls. Use HTTPS or localhost.');
      }

      this.setState('requesting-mic');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      // Resolve the signaling identity from the server-side call session.
      // This is more reliable than decoding a JWT in the browser, especially
      // on devices that have previously used both client and admin portals.
      this.currentUserId = await getSessionIdentity(this.sessionId, this.headers, this.isInitiator)
        || this.currentUserId;

      const iceServers = await getIceServers(this.headers);
      this.pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      });

      this.localStream.getTracks().forEach(track => this.pc.addTrack(track, this.localStream));

      this.pc.ontrack = event => {
        const stream = event.streams?.[0];
        if (!stream) return;
        if (!this.remoteAudio) {
          this.remoteAudio = document.createElement('audio');
          this.remoteAudio.autoplay = true;
          this.remoteAudio.playsInline = true;
          this.remoteAudio.controls = false;
          this.remoteAudio.dataset.callAudio = this.sessionId;
          this.remoteAudio.style.position = 'fixed';
          this.remoteAudio.style.width = '1px';
          this.remoteAudio.style.height = '1px';
          this.remoteAudio.style.opacity = '0.01';
          this.remoteAudio.style.pointerEvents = 'none';
          document.body.appendChild(this.remoteAudio);
        }
        this.remoteAudio.srcObject = stream;
        const playRemote = () => this.remoteAudio?.play().catch((error) => {
          console.warn('[Manlung WebRTC] remote audio autoplay was blocked:', error);
        });
        playRemote();
      };

      this.pc.onicecandidate = event => {
        if (event.candidate && !this.ended) {
          this.sendSignal('ice-candidate', { candidate: event.candidate.toJSON() }).catch(() => {});
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        if (state === 'failed') {
          this.setState('connection-failed', 'ICE negotiation failed. Check that the Vercel TURN_URL, TURN_USERNAME and TURN_CREDENTIAL variables are configured for production.');
        } else if (state === 'disconnected' && this.connectedAt) {
          this.setState('reconnecting');
        }
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected' && !this.connectedAt) {
          if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
          stopRingtone();
          this.connectedAt = Date.now();
          this.setState('connected');
          this.durationTimer = setInterval(() => {
            if (this.connectedAt && !this.ended) {
              this.onDuration(formatDuration((Date.now() - this.connectedAt) / 1000));
            }
          }, 1000);
        } else if (state === 'failed') {
          this.setState('connection-failed', 'WebRTC could not establish an audio path. TURN is required for some mobile, VPN and restricted networks.');
        } else if (state === 'disconnected' && this.connectedAt) {
          this.setState('reconnecting');
        }
      };

      this.signalTimer = setInterval(() => this.pollSignals().catch(error => { console.error('[Manlung WebRTC] signal poll error:', error); }), 500);
      await this.pollSignals();

      if (this.isInitiator) {
        await this.sendOffer();
        this.setState('ringing');
        startRingtone();
      } else {
        this.setState('connecting');
      }

      // Do not leave either side stuck forever after microphone permission
      // succeeds but ICE cannot complete.
      this.connectionTimeout = setTimeout(() => {
        if (!this.ended && !this.connectedAt) {
          this.setState('connection-failed', 'Connection timed out. This usually means the network needs a working TURN relay.');
        }
      }, 20000);
    }

    async sendSignal(event, payload) {
      if (this.ended) return;
      const res = await fetch(`/api/calls/${encodeURIComponent(this.sessionId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body: JSON.stringify({ event, payload: payload || {} }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Signal ${event} failed`);
      }
      return res.json();
    }

    async pollSignals() {
      if (this.ended) return;
      const res = await fetch(`/api/calls/${encodeURIComponent(this.sessionId)}/signals?after=${this.signalCursor}`, {
        headers: this.headers,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const signal of (data.signals || [])) {
        this.signalCursor = Math.max(this.signalCursor, Number(signal.id) || 0);
        if (signal.sender_user_id === this.currentUserId) continue;
        await this.handleSignal(signal);
      }
    }

    async handleSignal(signal) {
      if (!this.pc || this.ended) return;
      try {
        if (signal.event === 'offer' && !this.isInitiator) {
          const remoteOffer = signal.payload?.sdp;
          const offerDescription = typeof remoteOffer === 'string'
            ? { type: 'offer', sdp: remoteOffer }
            : remoteOffer;
          if (!offerDescription?.sdp) throw new Error('Admin received an invalid WebRTC offer.');

          await this.pc.setRemoteDescription(offerDescription);
          this.remoteDescriptionSet = true;
          await this.flushPendingIce();
          if (!this.answerSent) {
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            await this.sendSignal('answer', {
              sdp: { type: this.pc.localDescription?.type || 'answer', sdp: this.pc.localDescription?.sdp || '' },
            });
            this.answerSent = true;
          }
        } else if (signal.event === 'answer' && this.isInitiator) {
          if (this.pc.signalingState !== 'have-local-offer') return;
          const remoteAnswer = signal.payload?.sdp;
          const answerDescription = typeof remoteAnswer === 'string'
            ? { type: 'answer', sdp: remoteAnswer }
            : remoteAnswer;
          if (!answerDescription?.sdp) throw new Error('Client received an invalid WebRTC answer.');
          await this.pc.setRemoteDescription(answerDescription);
          this.remoteDescriptionSet = true;
          await this.flushPendingIce();
        } else if (signal.event === 'ice-candidate') {
          const candidate = signal.payload?.candidate;
          if (!candidate) return;
          if (!this.remoteDescriptionSet) this.pendingIce.push(candidate);
          else await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else if (signal.event === 'end') {
          this.remoteEndSeen = true;
          this.handleRemoteEnd();
        }
      } catch (error) {
        console.error('[Manlung WebRTC] signal handling error:', error);
        this.setState('connection-failed', error.message);
      }
    }

    async sendOffer() {
      if (!this.isInitiator || this.offerSent || !this.pc || this.ended) return;
      this.offerSent = true;
      const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
      await this.pc.setLocalDescription(offer);
      await this.sendSignal('offer', { sdp: this.pc.localDescription });
    }

    async flushPendingIce() {
      if (!this.pc || !this.remoteDescriptionSet) return;
      const candidates = this.pendingIce.splice(0);
      for (const candidate of candidates) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
      }
    }

    async enableRemoteAudio() {
      if (!this.remoteAudio) return false;
      try {
        await this.remoteAudio.play();
        return true;
      } catch (_) {
        return false;
      }
    }

    toggleMute() {
      const track = this.localStream?.getAudioTracks()?.[0];
      if (!track) return null;
      track.enabled = !track.enabled;
      return !track.enabled;
    }

    handleRemoteEnd() {
      if (this.ended) return;
      this.setState('ended-by-remote');
      this.cleanup();
    }

    async end() {
      if (this.ended) return;
      try {
        if (!this.endSent) {
          this.endSent = true;
          await this.sendSignal('end', {});
        }
      } catch (_) {}
      this.cleanup();
    }

    cleanup() {
      stopRingtone();
      this.ended = true;
      if (this.durationTimer) clearInterval(this.durationTimer);
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      if (this.signalTimer) clearInterval(this.signalTimer);
      this.durationTimer = null;
      this.connectionTimeout = null;
      this.signalTimer = null;
      this.localStream?.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
      this.localStream = null;
      try { this.pc?.close(); } catch (_) {}
      this.pc = null;
      if (this.remoteAudio) {
        try { this.remoteAudio.pause(); this.remoteAudio.srcObject = null; this.remoteAudio.remove(); } catch (_) {}
        this.remoteAudio = null;
      }
      document.querySelectorAll(`audio[data-call-audio="${this.sessionId}"]`).forEach(el => el.remove());
      this.pendingIce = [];
    }
  }

  window.ManlungCallWebRTC = { CallPeer, getPublicConfig, formatDuration };
})();
