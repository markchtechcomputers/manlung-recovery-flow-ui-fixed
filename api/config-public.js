// Lightweight public configuration endpoint kept separate from the main API
// so login security setup can still load if another application module fails.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const turnstileSiteKey =
    process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ||
    process.env.TURNSTILE_SITE_KEY ||
    null;
  const turnstileSecretKey =
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    process.env.TURNSTILE_SECRET_KEY ||
    null;
  const turnstileConfigured = Boolean(turnstileSiteKey && turnstileSecretKey);

  return res.status(200).json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    turnstileSiteKey,
    turnstileEnabled:
      turnstileConfigured &&
      (String(process.env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true' ||
        process.env.NODE_ENV === 'production'),
  });
};
