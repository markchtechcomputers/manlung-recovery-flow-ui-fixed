const crypto = require('crypto');

// Process-local denylist for immediate logout invalidation. JWT expiry remains
// the durable backstop; this list closes the logout gap until a shared store
// such as Redis is configured for multi-instance deployments.
const revokedTokens = new Map();
const MAX_ENTRIES = 10000;

function tokenKey(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function revokeToken(token, expiresAtSeconds) {
  if (!token) return;
  const expiresAt = Number(expiresAtSeconds || 0) * 1000 || (Date.now() + 7 * 24 * 60 * 60 * 1000);
  revokedTokens.set(tokenKey(token), expiresAt);
  if (revokedTokens.size > MAX_ENTRIES) {
    for (const [key, expiry] of revokedTokens) {
      if (expiry <= Date.now()) revokedTokens.delete(key);
      if (revokedTokens.size <= MAX_ENTRIES) break;
    }
  }
}

function isTokenRevoked(token) {
  if (!token) return false;
  const key = tokenKey(token);
  const expiresAt = revokedTokens.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    revokedTokens.delete(key);
    return false;
  }
  return true;
}

module.exports = { revokeToken, isTokenRevoked };
