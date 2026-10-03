const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Accept the descriptive Cloudflare-prefixed names as well as the original
// project names so existing deployments do not break during key rotation.
const TURNSTILE_SECRET_KEY = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY;

function isEnabled() {
  if (String(process.env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true') return true;
  return process.env.NODE_ENV === 'production' && Boolean(TURNSTILE_SECRET_KEY);
}

async function verifyTurnstile(token, remoteIp) {
  if (!isEnabled()) return { success: true, skipped: true };
  if (!token || typeof token !== 'string' || token.length > 2048) {
    return { success: false, errorCodes: ['missing-or-invalid-token'] };
  }
  if (!TURNSTILE_SECRET_KEY) {
    return { success: false, errorCodes: ['missing-server-secret'] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp || undefined,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { success: false, errorCodes: ['siteverify-http-error'] };

    const result = await response.json();
    return {
      success: Boolean(result.success),
      errorCodes: Array.isArray(result['error-codes']) ? result['error-codes'] : [],
      hostname: result.hostname || null,
      action: result.action || null,
    };
  } catch (error) {
    console.error('Turnstile validation error:', error?.message || error);
    return { success: false, errorCodes: ['internal-error'] };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { verifyTurnstile, isEnabled };
