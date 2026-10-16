const express = require('express');
const router = express.Router();

const TURNSTILE_SITE_KEY = process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY;
const TURNSTILE_SECRET_KEY = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_CONFIGURED = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);

router.get('/public', (req, res) => {
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    turnstileSiteKey: TURNSTILE_SITE_KEY || null,
    turnstileEnabled: TURNSTILE_CONFIGURED && (String(process.env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production'),
  });
});

module.exports = router;
