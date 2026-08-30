const express = require('express');
const router = express.Router();

router.get('/public', (req, res) => {
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    // Optional branded Supabase Auth custom domain. If configured, OAuth traffic
    // can use the branded auth hostname instead of the default *.supabase.co host.
    supabaseAuthUrl: process.env.SUPABASE_AUTH_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
});

module.exports = router;
