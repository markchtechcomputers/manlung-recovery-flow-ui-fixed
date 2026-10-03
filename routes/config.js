const express = require('express');
const router = express.Router();

// Turnstile's site key is intentionally public and is safe to return to the
// browser. The secret key is never returned from this route.
const TURNSTILE_SITE_KEY =
  process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ||
  process.env.TURNSTILE_SITE_KEY ||
  process.env.CLOUDFLARE_SITE_KEY ||
  process.env.TURNSTILE_PUBLIC_KEY ||
  process.env.TURNSTILE_SITEKEY ||
  null;

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
