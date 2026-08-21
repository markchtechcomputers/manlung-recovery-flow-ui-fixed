const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

const app = express();

// Security middleware
app.use(
  helmet({
    // CSP stays disabled for now because the site currently uses
    // inline scripts and third-party resources.
    contentSecurityPolicy: false,

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
  })
);

app.disable('x-powered-by');

// CSP audit mode: report violations without breaking the existing site.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self' https:",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:"
    ].join('; ')
  );

  next();
});

// CORS
const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS || ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction =
  process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser requests have no Origin header.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow the current application origin itself.
      // This keeps same-origin browser requests working even if
      // ALLOWED_ORIGINS is missing/misconfigured in Vercel.
      const forwardedProto =
        req.get('x-forwarded-proto') ||
        req.protocol;

      const currentOrigin =
        `${forwardedProto}://${req.get('host')}`;

      if (origin === currentOrigin) {
        return callback(null, true);
      }

      // Never silently allow every website in production.
      if (isProduction) {
        return callback(
          new Error('Origin not allowed')
        );
      }

      // Development convenience only.
      const developmentOrigins = new Set([
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000',
      ]);

      if (
        developmentOrigins.has(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error('Origin not allowed')
      );
    },
  })
);

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

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb',
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

    if (error) {
      health.databaseError = error.message;
    }
  } catch (e) {
    health.database = 'error';
    health.databaseError = e.message;
  }

  res
    .status(health.database === 'ok' ? 200 : 503)
    .json(health);
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

// Authenticated/API data must never be stored in browser or proxy caches.
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
  console.error(err.stack);

  res.status(500).json({
    success: false,
    error: err.message || 'Something went wrong!',
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
