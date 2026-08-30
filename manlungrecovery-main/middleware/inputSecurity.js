const DANGEROUS_SCHEMES = /(?:^|\s)(?:javascript|vbscript|file|data):/i;
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const NULL_BYTE = /\u0000/;
const CONTROL_CHARS = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_DEPTH = 20;
const MAX_OBJECT_KEYS = 100;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const HTML_TAG = /<\s*\/?\s*[a-z][^>]*>/i;

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

  // API fields are stored and later rendered by several administrative/client
  // views. Reject HTML markup entirely so stored XSS cannot be reintroduced
  // through a less-obvious tag or attribute.
  if (HTML_TAG.test(value)) {
    return 'HTML markup is not allowed in request data.';
  }

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
    const entries = Object.entries(value);
    if (entries.length > MAX_OBJECT_KEYS) {
      return 'Request contains too many fields.';
    }

    for (const [key, child] of entries) {
      if (DANGEROUS_KEYS.has(key)) {
        return 'Request contains a forbidden property name.';
      }

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
