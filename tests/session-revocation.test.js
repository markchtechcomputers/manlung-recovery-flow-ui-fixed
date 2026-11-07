const test = require('node:test');
const assert = require('node:assert/strict');

const redisPath = require.resolve('@upstash/redis');
const sessionPath = require.resolve('../middleware/sessionRevocation');

function loadModule({ nodeEnv = 'test', url, token, redisClient } = {}) {
  const oldEnv = {
    NODE_ENV: process.env.NODE_ENV,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const oldRedis = require.cache[redisPath];
  const oldSession = require.cache[sessionPath];

  process.env.NODE_ENV = nodeEnv;

  if (url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = url;

  if (token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = token;

  if (redisClient) {
    require.cache[redisPath] = {
      id: redisPath,
      filename: redisPath,
      loaded: true,
      exports: { Redis: { fromEnv: () => redisClient } },
      children: [],
      paths: [],
    };
  } else {
    delete require.cache[redisPath];
  }

  delete require.cache[sessionPath];
  const moduleUnderTest = require(sessionPath);

  return {
    module: moduleUnderTest,
    restore() {
      for (const [key, value] of Object.entries(oldEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }

      delete require.cache[sessionPath];
      delete require.cache[redisPath];

      if (oldSession) require.cache[sessionPath] = oldSession;
      if (oldRedis) require.cache[redisPath] = oldRedis;
    },
  };
}

test('local development revokes and detects a token', async () => {
  const setup = loadModule({ nodeEnv: 'test' });

  try {
    const token = 'local-test-token';
    const expiry = Math.floor(Date.now() / 1000) + 120;

    await setup.module.revokeToken(token, expiry);

    assert.equal(await setup.module.isTokenRevoked(token), true);
    assert.equal(await setup.module.isTokenRevoked('another-token'), false);
  } finally {
    setup.restore();
  }
});

test('rejects missing or invalid JWT expiration', async () => {
  const setup = loadModule({ nodeEnv: 'test' });

  try {
    for (const expiry of [undefined, 0, -1, NaN, 'invalid']) {
      await assert.rejects(
        setup.module.revokeToken('invalid-expiry-token', expiry),
        /valid JWT expiration/
      );
    }
  } finally {
    setup.restore();
  }
});

test('does not store an already-expired token', async () => {
  const setup = loadModule({ nodeEnv: 'test' });

  try {
    const token = 'expired-test-token';
    const expiry = Math.floor(Date.now() / 1000) - 60;

    await setup.module.revokeToken(token, expiry);

    assert.equal(await setup.module.isTokenRevoked(token), false);
  } finally {
    setup.restore();
  }
});

test('production fails closed when Redis is not configured', async () => {
  const setup = loadModule({ nodeEnv: 'production' });

  try {
    await assert.rejects(
      setup.module.isTokenRevoked('production-test-token'),
      { code: 'REVOCATION_STORE_UNAVAILABLE' }
    );

    await assert.rejects(
      setup.module.revokeToken(
        'production-test-token',
        Math.floor(Date.now() / 1000) + 120
      ),
      { code: 'REVOCATION_STORE_UNAVAILABLE' }
    );
  } finally {
    setup.restore();
  }
});

test('Redis stores token hashes with expiry and reads revocation status', async () => {
  const stored = new Map();
  let setArgs;

  const fakeRedis = {
    async set(key, value, options) {
      setArgs = { key, value, options };
      stored.set(key, value);
    },
    async get(key) {
      return stored.get(key) ?? null;
    },
  };

  const setup = loadModule({
    nodeEnv: 'production',
    url: 'https://example.upstash.io',
    token: 'test-only-token',
    redisClient: fakeRedis,
  });

  try {
    const token = 'redis-test-token';
    const expiry = Math.floor(Date.now() / 1000) + 120;

    await setup.module.revokeToken(token, expiry);

    assert.match(setArgs.key, /^session:revoked:[a-f0-9]{64}$/);
    assert.equal(setArgs.key.includes(token), false);
    assert.equal(setArgs.value, '1');
    assert.ok(setArgs.options.ex > 0 && setArgs.options.ex <= 120);
    assert.equal(await setup.module.isTokenRevoked(token), true);
  } finally {
    setup.restore();
  }
});

test('Redis failures return REVOCATION_STORE_UNAVAILABLE', async () => {
  const fakeRedis = {
    async set() {
      throw new Error('simulated Redis write failure');
    },
    async get() {
      throw new Error('simulated Redis read failure');
    },
  };

  const setup = loadModule({
    nodeEnv: 'production',
    url: 'https://example.upstash.io',
    token: 'test-only-token',
    redisClient: fakeRedis,
  });

  try {
    await assert.rejects(
      setup.module.revokeToken(
        'redis-failure-token',
        Math.floor(Date.now() / 1000) + 120
      ),
      { code: 'REVOCATION_STORE_UNAVAILABLE' }
    );

    await assert.rejects(
      setup.module.isTokenRevoked('redis-failure-token'),
      { code: 'REVOCATION_STORE_UNAVAILABLE' }
    );
  } finally {
    setup.restore();
  }
});
