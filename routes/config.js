const express = require('express');
const router = express.Router();

router.get('/public', (req, res) => {
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
    turnstileEnabled: String(process.env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true' || (process.env.NODE_ENV === 'production' && Boolean(process.env.TURNSTILE_SECRET_KEY)),
  });
});

module.exports = router;
