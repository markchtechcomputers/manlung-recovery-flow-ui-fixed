const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dns = require('dns').promises;
const https = require('https');
const http = require('http');
const net = require('net');
const { URL } = require('url');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const configRoutes = require('./routes/config');
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');
const subscriptionRoutes = require('./routes/subscription');
const callRoutes = require('./routes/calls');
const donationRoutes = require('./routes/donations');
const ownerRoutes = require('./routes/owner');
const careerRoutes = require('./routes/careers');
const { supabase } = require('./config/supabase');
const { inputSecurity } = require('./middleware/inputSecurity');
const OFFICIAL_WEBSITES = require('./config/official-websites');

const app = express();

// Vercel sits behind a trusted reverse proxy. This lets Express apply
// client-aware rate limits using the forwarded address.
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://js.paystack.co'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.paystack.co', 'wss:', 'https:'],
        frameSrc: ["'self'", 'https://js.paystack.co'],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },

    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },

    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups',
    },

    frameguard: {
      action: 'deny',
    },

    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },

    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  })
);

// WebRTC requires microphone access from the first-party site. Keep camera
// and microphone available only to this origin; disable unrelated sensors.
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=()'
  );
  next();
});

app.disable('x-powered-by');

// CORS
const defaultAllowedOrigins = [
  'https://manlungrecovery.manlungshop.co.ke',
];

if (process.env.NODE_ENV !== 'production') {
  defaultAllowedOrigins.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const effectiveAllowedOrigins = allowedOrigins.length
  ? allowedOrigins
  : defaultAllowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser requests do not send Origin and remain supported.
    if (!origin || effectiveAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed'));
  },
}));

// ============================================================
// GENERAL API RATE LIMITER
// ============================================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,

  // Call Admin polling routes have their own limiter below.
  skip: (req) => {
    return (
      req.path.startsWith('/calls/admin/online') ||
      req.path.startsWith('/calls/admin/offline') ||
      req.path.startsWith('/calls/pending') ||
      req.path.startsWith('/calls/availability')
    );
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many API requests. Please wait a moment and try again.'
    });
  },
});

app.use('/api/', limiter);

// ============================================================
// CALL ADMIN POLLING RATE LIMITER
// ============================================================

const callPollingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many call polling requests. Please wait a moment and try again.'
    });
  },
});

app.use('/api/calls/admin/online', callPollingLimiter);
app.use('/api/calls/admin/offline', callPollingLimiter);
app.use('/api/calls/pending', callPollingLimiter);
app.use('/api/calls/availability', callPollingLimiter);

// ============================================================
// NOTIFICATION RATE LIMITER
// ============================================================

const notificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:
        'Too many notification requests. Please wait a moment and try again.',
    });
  },
});

app.use('/api/notifications', notificationLimiter);

// ============================================================
// LOGIN RATE LIMITER
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please wait 15 minutes and try again.'
    });
  },
});

app.use('/api/auth/admin/login', loginLimiter);
app.use('/api/auth/client/login', loginLimiter);

// ============================================================
// AUTH ACTION RATE LIMITER
// ============================================================

const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:
        'Too many authentication requests. Please wait and try again later.',
    });
  },
});

app.use('/api/auth/client/register', authActionLimiter);
app.use('/api/auth/client/oauth', authActionLimiter);
app.use('/api/auth/admin/register', authActionLimiter);
app.use('/api/auth/admin/forgot-password', authActionLimiter);
app.use('/api/auth/client/forgot-password', authActionLimiter);

// ============================================================
// PAYMENT RATE LIMITER
// ============================================================

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many payment requests. Please wait a few minutes and try again.'
    });
  },
});

app.use('/api/subscription/initialize', paymentLimiter);
app.use('/api/subscription/verify', paymentLimiter);
app.use('/api/donations/initialize', paymentLimiter);
app.use('/api/donations/verify', paymentLimiter);

// ============================================================
// CALL START RATE LIMITER
// ============================================================

const callStartLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many call attempts. Please wait before trying again.'
    });
  },
});

app.use('/api/calls/start', callStartLimiter);

// Public career submissions are rate-limited separately so a bot cannot
// exhaust the general API budget or flood the recruitment table.
const careerSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many applications. Please try again later.'
    });
  },
});

app.use('/api/careers', careerSubmissionLimiter);

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

// Validate API input before it reaches route handlers.
app.use('/api/', inputSecurity);

// ============================================================
// STATIC FRONTEND FILES
// ============================================================

app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    server: 'up',
    database: 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('recovery_cases')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .limit(1);

    health.database = error ? 'error' : 'ok';

    if (error && process.env.NODE_ENV !== 'production') {
      health.databaseError = error.message;
    }
  } catch (e) {
    health.database = 'error';
    if (process.env.NODE_ENV !== 'production') {
      health.databaseError = e.message;
    }
  }

  res
    .status(health.database === 'ok' ? 200 : 503)
    .json(health);
});

// API responses contain private account, case, payment and call data.
// Disable intermediary/browser caching before any API route can respond.
app.use('/api/', (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Alias for call-admin payment routes
app.use('/api/payments/call-admin', subscriptionRoutes);

app.use('/api/calls', callRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/careers', careerRoutes);

// ============================================================
// ADMIN PAGES
// ============================================================

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

// ============================================================
// CLIENT LANDING PAGE
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});


// ============================================================
// EXTERNAL WEBSITE SAFETY SCANNER
// ============================================================

// Verified official website directory used by the scanner.
// Keep this list explicit: technical checks alone cannot prove ownership.
function normalizeHostname(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function isVerifiedOfficialHost(hostname, officialHost) {
  const normalized = normalizeHostname(hostname);
  const root = normalizeHostname(officialHost);
  return normalized === root || normalized.endsWith(`.${root}`);
}

function levenshteinDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function extractPageTitle(body) {
  const match = String(body || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function stripHtml(body) {
  return String(body || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200000);
}

function findOfficialWebsite(hostname) {
  const normalized = normalizeHostname(hostname);
  const match = OFFICIAL_WEBSITES.find(site => isVerifiedOfficialHost(normalized, site.hostname));

  if (!match) {
    return {
      found: false,
      url: null,
      name: null,
      description: null,
      hostname: null,
      reason: 'The scanned domain is not in the verified official-website directory.'
    };
  }

  return {
    found: true,
    url: match.url,
    name: match.name,
    description: match.description,
    hostname: match.hostname,
    reason: normalized === normalizeHostname(match.hostname)
      ? 'The scanned domain exactly matches a verified official website.'
      : `The scanned hostname is a subdomain of the verified official domain ${match.hostname}.`
  };
}

function detectImpersonation(hostname, body) {
  const normalized = normalizeHostname(hostname);
  const labels = normalized.split('.').filter(Boolean);
  const pageTitle = extractPageTitle(body);
  const pageText = stripHtml(body).toLowerCase();
  const candidates = [];

  for (const site of OFFICIAL_WEBSITES) {
    const officialHost = normalizeHostname(site.hostname);
    if (isVerifiedOfficialHost(normalized, officialHost)) continue;

    const rootLabel = officialHost.split('.')[0];
    const aliases = [rootLabel, ...(site.aliases || [])]
      .map(value => String(value).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(value => value.length >= 3);

    const compactHostname = normalized.replace(/[^a-z0-9]/g, '');
    const hostnameBrandMatch = aliases.find(alias => compactHostname.includes(alias));
    const titleBrandMatch = aliases.find(alias => pageTitle.toLowerCase().replace(/[^a-z0-9]/g, '').includes(alias));

    const rootDistance = levenshteinDistance(
      labels[0] || '',
      rootLabel.replace(/[^a-z0-9]/g, '')
    );
    const typoMatch = rootLabel.length >= 4 && rootDistance > 0 && rootDistance <= 2;

    const brandPhraseMatch = (site.aliases || [])
      .filter(alias => String(alias).includes(' '))
      .some(alias => pageText.includes(String(alias).toLowerCase()));

    if (hostnameBrandMatch || titleBrandMatch || typoMatch || brandPhraseMatch) {
      const reasons = [];
      if (hostnameBrandMatch) reasons.push(`The hostname contains a term associated with ${site.name}.`);
      if (titleBrandMatch) reasons.push(`The page title references ${site.name}.`);
      if (typoMatch) reasons.push(`The hostname is very similar to the official ${site.name} domain.`);
      if (brandPhraseMatch) reasons.push(`The page content references ${site.name}.`);

      candidates.push({
        name: site.name,
        officialUrl: site.url,
        officialHostname: site.hostname,
        reasons
      });
    }
  }

  if (!candidates.length) {
    return {
      status: 'none',
      label: 'Impersonation / clone check',
      details: 'No strong impersonation signal was detected from the verified brand directory.',
      candidates: []
    };
  }

  const candidate = candidates[0];
  return {
    status: 'critical',
    label: 'Possible impersonation / clone',
    details: `The site may be attempting to imitate ${candidate.name}.`,
    candidates,
    reasons: candidate.reasons,
    recommendation: `Compare the domain with the verified official domain ${candidate.officialHostname} before entering credentials, making payments or sharing personal information.`
  };
}


const scannerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many scans. Please wait and try again.'
  }
});

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIPv6(ip) {
  const value = String(ip).toLowerCase();

  // IPv4-mapped IPv6 addresses can otherwise bypass an IPv4-only check.
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice(7);
    if (net.isIPv4(mapped)) return isPrivateIPv4(mapped);
  }

  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('ff')
  );
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

async function resolvePublicAddresses(hostname) {
  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error('No public DNS address found.');
  }

  const privateAddress = addresses.find(entry => isPrivateAddress(entry.address));

  if (privateAddress) {
    throw new Error('The destination resolves to a private or reserved network address.');
  }

  return addresses
    .filter(entry => !isPrivateAddress(entry.address))
    .map(entry => ({
      address: entry.address,
      family: entry.family
    }));
}

function requestWebsite(targetUrl, addresses, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const request = client.request(
      parsed,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Manlung-Recovery-Safety-Scanner/1.1',
          'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
        },
        // Pin the outbound connection to the DNS result we just validated.
        // This reduces DNS-rebinding SSRF risk between lookup and connect.
        lookup: (_hostname, _options, callback) => {
          const address = addresses?.[0];
          if (!address) return callback(new Error('No validated public address available.'));
          callback(null, address.address, address.family);
        },
        maxHeaderSize: 32 * 1024,
        joinDuplicateHeaders: false
      },
      response => {
        const chunks = [];
        let total = 0;
        let truncated = false;
        const maxBodyBytes = 512 * 1024;

        response.on('data', chunk => {
          total += chunk.length;

          if (total <= maxBodyBytes) {
            chunks.push(chunk);
            return;
          }

          // Stop consuming oversized pages instead of continuing to spend
          // bandwidth/memory on attacker-controlled content.
          truncated = true;
          response.destroy();
        });

        response.on('close', () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            location: response.headers.location || null,
            truncated,
            tls: parsed.protocol === 'https:' ? {
              authorized: response.socket?.authorized !== false,
              protocol: response.socket?.getProtocol?.() || null
            } : null
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Request timed out.'));
    });

    request.on('error', reject);
    request.end();
  });
}

function normalizeUrl(value) {
  let input = String(value || '').trim();

  if (!input) {
    throw new Error('Please enter a website URL.');
  }

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  if (input.length > 2048) {
    throw new Error('The website URL is too long.');
  }

  const parsed = new URL(input);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS websites can be scanned.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs containing usernames or passwords are not allowed.');
  }

  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    throw new Error('Only standard HTTP and HTTPS ports can be scanned.');
  }

  const host = String(parsed.hostname || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Local or internal hostnames cannot be scanned.');
  }

  parsed.hash = '';

  return parsed;
}

function analyzeHeaders(headers) {
  const expected = [
    'strict-transport-security',
    'content-security-policy',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy'
  ];

  const present = expected.filter(name => headers[name]);

  return {
    score: present.length,
    total: expected.length,
    present,
    missing: expected.filter(name => !headers[name])
  };
}

function analyzeDomain(hostname) {
  const labels = hostname.split('.').filter(Boolean);
  const warnings = [];

  if (labels.length > 4) {
    warnings.push('The hostname contains an unusually large number of subdomains.');
  }

  if (hostname.includes('--')) {
    warnings.push('The hostname contains repeated hyphens.');
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    warnings.push('The URL uses an IP address instead of a normal domain name.');
  }

  return {
    reasonable: warnings.length === 0,
    warnings
  };
}

app.post('/api/link-scanner/scan', scannerLimiter, async (req, res) => {
  const startedAt = Date.now();

  try {
    const parsed = normalizeUrl(req.body?.url);
    const originalUrl = parsed.toString();

    const addresses = await resolvePublicAddresses(parsed.hostname);

    const checks = {
      dns: {
        status: 'good',
        label: 'DNS / public availability',
        details: `Resolved to ${addresses.map(a => a.address).join(', ')}`
      },
      https: {
        status: parsed.protocol === 'https:' ? 'good' : 'warning',
        label: 'HTTPS / TLS',
        details: parsed.protocol === 'https:'
          ? 'The submitted URL uses HTTPS.'
          : 'The submitted URL does not use HTTPS.'
      },
      headers: null,
      redirects: {
        status: 'good',
        label: 'Redirects',
        details: 'No redirect chain has been followed yet.'
      },
      domain: null,
      reputation: {
        status: 'warning',
        label: 'Independent reputation',
        details: 'No independent reputation database is configured for this scan.'
      },
      impersonation: null
    };

    let currentUrl = originalUrl;
    const redirects = [];
    let finalResponse = null;

    for (let i = 0; i <= 5; i++) {
      const current = normalizeUrl(currentUrl);

      const currentAddresses = await resolvePublicAddresses(current.hostname);

      const response = await requestWebsite(current.toString(), currentAddresses);

      finalResponse = response;

      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.location
      ) {
        if (i === 5) {
          throw new Error('Too many redirects.');
        }

        const nextUrl = new URL(response.location, current).toString();

        redirects.push({
          from: current.toString(),
          to: nextUrl,
          statusCode: response.statusCode
        });

        currentUrl = nextUrl;
        continue;
      }

      break;
    }

    if (!finalResponse) {
      throw new Error('The website did not return a response.');
    }

    const finalParsed = normalizeUrl(currentUrl);
    const officialWebsite = findOfficialWebsite(finalParsed.hostname);
    const impersonation = detectImpersonation(finalParsed.hostname, finalResponse.body);

    const headerAnalysis = analyzeHeaders(finalResponse.headers);
    const domainAnalysis = analyzeDomain(finalParsed.hostname);

    checks.headers = {
      status: headerAnalysis.score >= 3
        ? 'good'
        : headerAnalysis.score >= 1
          ? 'warning'
          : 'critical',
      label: 'Security headers',
      details: `${headerAnalysis.score}/${headerAnalysis.total} recommended headers detected.`,
      present: headerAnalysis.present,
      missing: headerAnalysis.missing
    };

    checks.redirects = {
      status: redirects.length <= 2
        ? 'good'
        : redirects.length <= 5
          ? 'warning'
          : 'critical',
      label: 'Redirects',
      details: redirects.length
        ? `${redirects.length} redirect(s) followed.`
        : 'No redirects detected.',
      chain: redirects
    };

    checks.domain = {
      status: domainAnalysis.reasonable ? 'good' : 'warning',
      label: 'Domain structure',
      details: domainAnalysis.reasonable
        ? 'No obvious structural anomaly was detected.'
        : domainAnalysis.warnings.join(' '),
      warnings: domainAnalysis.warnings
    };

    checks.impersonation = impersonation;

    const evidence = [];

    if (checks.https.status === 'warning') {
      evidence.push('The submitted URL does not use HTTPS.');
    }

    if (checks.headers.status === 'critical') {
      evidence.push('No recommended security headers were detected.');
    }

    if (checks.redirects.status === 'warning') {
      evidence.push('The website uses multiple redirects.');
    }

    if (!domainAnalysis.reasonable) {
      evidence.push(...domainAnalysis.warnings);
    }

    if (impersonation.status === 'critical') {
      evidence.push(...(impersonation.reasons || []));
    }

    const criticalCount = Object.values(checks)
      .filter(check => check && check.status === 'critical').length;

    const warningCount = Object.values(checks)
      .filter(check => check && check.status === 'warning').length;

    let overallStatus = 'good';

    if (officialWebsite.found) {
      overallStatus = 'verified';
    } else if (impersonation.status === 'critical') {
      overallStatus = 'critical';
    } else if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 0) {
      overallStatus = 'warning';
    }

    res.json({
      success: true,
      scannedUrl: originalUrl,
      finalUrl: finalParsed.toString(),
      hostname: finalParsed.hostname,
      statusCode: finalResponse.statusCode,
      contentType: finalResponse.headers['content-type'] || null,
      pageTitle: extractPageTitle(finalResponse.body),

      result: {
        status: overallStatus,
        title:
          overallStatus === 'verified'
            ? 'Verified Official Website'
            : overallStatus === 'critical' && impersonation.status === 'critical'
              ? 'Likely Impersonation / Clone'
              : overallStatus === 'critical'
                ? 'High Risk Indicators Found'
                : overallStatus === 'warning'
                  ? 'Use Caution — Website Not Independently Verified'
                  : 'No Major Technical Problems Detected',

        explanation:
          overallStatus === 'verified'
            ? 'This domain matches a verified official domain. Technical warnings, if any, are shown separately below and do not change the ownership verification.'
            : overallStatus === 'critical' && impersonation.status === 'critical'
              ? impersonation.details
              : overallStatus === 'critical'
                ? 'One or more serious technical indicators require caution.'
                : overallStatus === 'warning'
                  ? 'The website is not independently verified and some technical warnings were detected. This does not by itself prove that the website is a scam.'
                  : 'The available technical checks did not identify major problems. This does not prove that the website is legitimate.'
      },

      officialWebsite,
      impersonation,

      checks,
      evidence,
      redirects,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,

      disclaimer:
        'This scan provides technical evidence only. A clean result does not prove that a website is legitimate, safe to pay, or officially owned by the claimed organization.'
    });

  } catch (error) {
    console.error('Link scanner error:', error.message);

    res.status(400).json({
      success: false,
      error: error.message || 'Unable to scan this website.'
    });
  }
});

// ============================================================
// 404 FOR UNKNOWN API ROUTES
// ============================================================

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error(err.stack || err);

  const message =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again later.'
      : (err.message || 'Something went wrong!');

  res.status(500).json({
    success: false,
    error: message,
  });
});

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
