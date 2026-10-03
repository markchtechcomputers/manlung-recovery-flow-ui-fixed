const express = require('express');
const router = express.Router();

// Turnstile's site key is intentionally public and is safe to return to the
// browser. The secret key is never returned from this route.
function getTurnstileSiteKey() {
  const direct = [
    'CLOUDFLARE_TURNSTILE_SITE_KEY',
    'TURNSTILE_SITE_KEY',
    'CLOUDFLARE_SITE_KEY',
    'TURNSTILE_PUBLIC_KEY',
    'TURNSTILE_SITEKEY',
    'CLOUDFLARE_TURNSTILE_PUBLIC_KEY',
    'CLOUDFLARE_TURNSTILE_SITEKEY',
    'CLOUDFLARE_TURNSTILE_PUBLIC_SITE_KEY',
  ];
  for (const name of direct) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }

  // Some deployments use a different public-key variable name. Discover only
  // variables explicitly marked as SITE/PUBLIC; never expose a SECRET value.
  for (const [name, raw] of Object.entries(process.env)) {
    const upper = String(name).toUpperCase();
    if (!upper.includes('TURNSTILE')) continue;
    if (!upper.includes('SITE') && !upper.includes('PUBLIC')) continue;
    if (upper.includes('SECRET') || upper.includes('PRIVATE')) continue;
    const value = String(raw || '').trim();
    if (value) return value;
  }
  return null;
}

const TURNSTILE_SITE_KEY = getTurnstileSiteKey();

router.get('/public', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    // Public Turnstile site key only. Never expose the Turnstile secret here.
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    turnstileEnabled: Boolean(TURNSTILE_SITE_KEY),
  });
});

module.exports = router;
