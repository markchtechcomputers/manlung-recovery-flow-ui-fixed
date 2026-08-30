const DANGEROUS_SCHEMES = /(?:^|\s)(?:javascript|vbscript|file|data):/i;
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const NULL_BYTE = /\u0000/;
const CONTROL_CHARS = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_DEPTH = 20;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const DANGEROUS_HTML = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*svg\b[^>]*\bon\w+\s*=/i,
  /\bon(?:error|load|click|mouseover|focus)\s*=/i,
];

const URL_LIKE_KEYS = new Set([
  'url',
  'redirect',
  'redirectTo',
  'callbackUrl',
  'returnUrl',
  'website',
  'link',
]);

const PATH_LIKE_KEYS = new Set([
  'path',
  'filename',
  'fileName',
  'storagePath',
  'filePath',
]);

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function inspectString(value, keyPath) {
  if (NULL_BYTE.test(value) || CONTROL_CHARS.test(value)) {
    return 'Input contains invalid control characters.';
  }

  const key =
    String(keyPath || '')
      .split('.')
      .pop();

  if (URL_LIKE_KEYS.has(key) && DANGEROUS_SCHEMES.test(value)) {
    return 'Unsafe URL scheme detected.';
  }

  if (PATH_LIKE_KEYS.has(key) && PATH_TRAVERSAL.test(value)) {
    return 'Unsafe file path detected.';
  }

  // Reject executable HTML/script payloads in user-controlled HTML-like
  // fields. Normal punctuation and ordinary text remain untouched.
  for (const pattern of DANGEROUS_HTML) {
    if (pattern.test(value)) {
      return 'Potentially executable HTML or script content detected.';
    }
  }

  return null;
}

function inspectValue(value, keyPath = '', depth = 0) {
  if (depth > MAX_DEPTH) return 'Input nesting is too deep.';
  if (typeof value === 'string') {
    return inspectString(value, keyPath);
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const error = inspectValue(
        value[i],
        `${keyPath}[${i}]`,
        depth + 1
      );

      if (error) return error;
    }

    return null;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) return 'Unsafe object property name detected.';
      const error = inspectValue(
        child,
        keyPath ? `${keyPath}.${key}` : key,
        depth + 1
      );

      if (error) return error;
    }
  }

  return null;
}

function inputSecurity(req, res, next) {
  try {
    const sources = [
      ['body', req.body],
      ['query', req.query],
      ['params', req.params],
    ];

    for (const [sourceName, value] of sources) {
      const error = inspectValue(
        value,
        sourceName
      );

      if (error) {
        return res.status(400).json({
          success: false,
          error,
        });
      }
    }

    return next();
  } catch (error) {
    console.error(
      'Input security middleware error:',
      error
    );

    return res.status(400).json({
      success: false,
      error: 'Invalid request data.',
    });
  }
}

module.exports = {
  inputSecurity,
};
