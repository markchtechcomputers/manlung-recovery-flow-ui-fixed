const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const revokedTokens = new Map();
const MAX_ENTRIES = 10000;
const KEY_PREFIX = 'session:revoked:';

let redisClient;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url && !token) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('Session revocation store is not configured');
      error.code = 'REVOCATION_STORE_UNAVAILABLE';
      throw error;
    }
    return null;
  }

  if (!url || !token) {
    const error = new Error('Session revocation configuration is incomplete');
    error.code = 'REVOCATION_STORE_UNAVAILABLE';
    throw error;
  }

  try {
    if (!redisClient) redisClient = Redis.fromEnv();
    return redisClient;
  } catch (cause) {
    const error = new Error('Redis initialization failed');
    error.code = 'REVOCATION_STORE_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
}

function tokenKey(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function unavailableError(cause) {
  const error = new Error('Session revocation store is unavailable');
  error.code = 'REVOCATION_STORE_UNAVAILABLE';
  error.cause = cause;
  return error;
}

async function revokeToken(token, expiresAtSeconds) {
  if (!token) return;

  const expiresAt = Number(expiresAtSeconds);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error('A valid JWT expiration is required');
  }

  const ttl = Math.ceil(expiresAt - Date.now() / 1000);
  if (ttl <= 0) return;

  const redis = getRedis();
  const key = KEY_PREFIX + tokenKey(token);

  if (redis) {
    try {
      await redis.set(key, '1', { ex: ttl });
      return;
    } catch (cause) {
      throw unavailableError(cause);
    }
  }

  revokedTokens.set(key, Date.now() + ttl * 1000);

  if (revokedTokens.size > MAX_ENTRIES) {
    for (const [entry, expiry] of revokedTokens) {
      if (expiry <= Date.now()) revokedTokens.delete(entry);
      if (revokedTokens.size <= MAX_ENTRIES) break;
    }
  }
}

async function isTokenRevoked(token) {
  if (!token) return false;

  const redis = getRedis();
  const key = KEY_PREFIX + tokenKey(token);

  if (redis) {
    try {
      const value = await redis.get(key);
      return value !== null && value !== undefined;
    } catch (cause) {
      throw unavailableError(cause);
    }
  }

  const expiresAt = revokedTokens.get(key);
  if (!expiresAt) return false;

  if (expiresAt <= Date.now()) {
    revokedTokens.delete(key);
    return false;
  }

  return true;
}

module.exports = { revokeToken, isTokenRevoked };
