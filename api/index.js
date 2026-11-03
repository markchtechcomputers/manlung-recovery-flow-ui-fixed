// Vercel auto-detects any file inside /api as a serverless function.
// Keep the Express application as the single source of truth. Catch only
// module-initialization failures so a failed import is logged and diagnosable
// instead of being converted into Vercel's opaque FUNCTION_INVOCATION_FAILED.
try {
  module.exports = require('../server.js');
} catch (error) {
  console.error('[MANLUNG_API_STARTUP_FAILURE]', error && error.stack ? error.stack : error);

  module.exports = function apiStartupFailure(_req, res) {
    // Detailed diagnostics are restricted to Preview deployments. Never expose
    // stack traces or internal paths from the Production API.
    if (process.env.VERCEL_ENV !== 'production') {
      return res.status(500).json({
        success: false,
        error: 'API startup failed',
        detail: String(error && error.message ? error.message : error),
        stack: error && error.stack ? String(error.stack) : null,
      });
    }

    return res.status(503).json({
      success: false,
      error: 'The API is temporarily unavailable. Please try again shortly.',
    });
  };
}
