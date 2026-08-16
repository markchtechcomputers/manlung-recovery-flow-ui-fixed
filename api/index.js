// Vercel auto-detects any file inside /api as a serverless function.
// This just re-exports the existing Express app from server.js unchanged —
// no duplicate logic, single source of truth stays in server.js.
module.exports = require('../server.js');
