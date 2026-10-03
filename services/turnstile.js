const https = require('https');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SECRET_KEY =
  process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
  process.env.TURNSTILE_SECRET_KEY;

function isEnabled() {
  if (String(process.env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true') return true;
  return process.env.NODE_ENV === 'production' && Boolean(TURNSTILE_SECRET_KEY);
}

function verifyTurnstile(token, remoteip) {
  if (!isEnabled()) return Promise.resolve({ success: true, skipped: true });
  if (!TURNSTILE_SECRET_KEY || !token) {
    return Promise.resolve({ success: false, errorCodes: !TURNSTILE_SECRET_KEY ? ['missing-secret'] : ['missing-input-response'] });
  }

  return new Promise((resolve) => {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    if (remoteip) body.set('remoteip', remoteip);
    const request = https.request(VERIFY_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body.toString())},
      timeout: 10000,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ success: Boolean(data.success), errorCodes: Array.isArray(data['error-codes']) ? data['error-codes'] : [] });
        } catch (_) { resolve({ success:false, errorCodes:['invalid-verification-response'] }); }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve({ success:false, errorCodes:['verification-request-failed'] }));
    request.write(body.toString());
    request.end();
  });
}

module.exports = { verifyTurnstile, isEnabled };
