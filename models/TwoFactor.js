const crypto = require('crypto');
const { generateSecret, generateURI, verify } = require('otplib');
const { supabase } = require('../config/supabase');

const TABLE = 'recovery_users';

function encryptionKey() {
  const hex = String(
    process.env.TWO_FACTOR_ENCRYPTION_KEY || ''
  ).trim();

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'TWO_FACTOR_ENCRYPTION_KEY must be exactly 32 bytes in hexadecimal.'
    );
  }

  return Buffer.from(hex, 'hex');
}

function encryptSecret(secret) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

function decryptSecret(value) {
  const key = encryptionKey();

  const [
    iv64,
    tag64,
    encrypted64,
  ] = String(value || '').split('.');

  if (!iv64 || !tag64 || !encrypted64) {
    throw new Error('Invalid encrypted 2FA secret.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv64, 'base64')
  );

  decipher.setAuthTag(
    Buffer.from(tag64, 'base64')
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encrypted64, 'base64')
    ),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

async function beginSetup(user) {
  const secret = generateSecret();

  const uri = generateURI({
    issuer: 'Manlung Recovery',
    label:
      user.email ||
      user.username ||
      `admin-${user.id}`,
    secret,
  });

  return {
    secret,
    uri,
  };
}

async function enable(userId, secret) {
  const encrypted = encryptSecret(secret);

  const { error } = await supabase
    .from(TABLE)
    .update({
      two_factor_enabled: true,
      two_factor_secret_enc: encrypted,
    })
    .eq('id', userId)
    .in('role', ['admin', 'owner']);

  if (error) throw error;
}

async function disable(userId) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      two_factor_enabled: false,
      two_factor_secret_enc: null,
      two_factor_recovery_codes: null,
    })
    .eq('id', userId)
    .in('role', ['admin', 'owner']);

  if (error) throw error;
}

async function verifySecret(secret, token) {
  const result = await verify({
    secret: String(secret || '').trim(),
    token: String(token || '').trim(),
  });

  return result.valid === true;
}

async function checkCode(user, token) {
  if (
    !user ||
    !user.two_factor_enabled ||
    !user.two_factor_secret_enc
  ) {
    return false;
  }

  const secret = decryptSecret(
    user.two_factor_secret_enc
  );

  const result = await verify({
    secret,
    token: String(token || '').trim(),
  });

  return result.valid === true;
}

module.exports = {
  beginSetup,
  enable,
  disable,
  verifySecret,
  checkCode,
};
