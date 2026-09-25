const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const CallSubscription = require('../models/CallSubscription');
const CallEntitlement = require('../models/CallEntitlement');
const { CALL_SUBSCRIPTION_PLANS, getCallSubscriptionPlan } = require('../config/call-subscription');

const PAYSTACK_URL = 'https://api.paystack.co';
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requirePaystack(res) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'Payment service is not configured on the server.' });
    return false;
  }
  return true;
}

function getPaystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

function createReference() {
  return `MTC-CALL-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

function publicPlan(plan) {
  return {
    code: plan.code,
    label: plan.label,
    amountKes: plan.amountKes,
    normalAmountKes: plan.normalAmountKes || null,
    discountPercent: plan.discountPercent || 0,
    billingLabel: plan.billingLabel,
    interval: plan.interval,
    months: plan.months,
  };
}

async function fetchConfiguredPaystackPlan(plan) {
  const envName = plan.paystackPlanEnv;
  const planCode = String(process.env[envName] || '').trim();
  if (!planCode) return null;

  const response = await axios.get(
    `${PAYSTACK_URL}/plan/${encodeURIComponent(planCode)}`,
    { headers: getPaystackHeaders(), timeout: 10000 }
  );

  const remote = response.data?.data;
  if (!remote) throw new Error(`Paystack plan ${planCode} could not be loaded.`);

  const remoteAmountKes = Number(remote.amount) / 100;
  const remoteCurrency = String(remote.currency || '').toUpperCase();
  const remoteInterval = String(remote.interval || '').toLowerCase();

  if (
    remoteAmountKes !== Number(plan.amountKes) ||
    remoteCurrency !== 'KES' ||
    remoteInterval !== plan.interval
  ) {
    throw new Error(
      `Paystack plan configuration mismatch for ${plan.code}. Expected KES ${plan.amountKes} / ${plan.interval}.`
    );
  }

  return { code: planCode, amountKes: remoteAmountKes, currency: remoteCurrency, interval: remoteInterval };
}

async function verifyWithPaystack(reference) {
  const response = await axios.get(
    `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: getPaystackHeaders(), timeout: 10000 }
  );
  return response.data?.data || null;
}

function normalizePaymentStatus(paystackStatus) {
  const status = String(paystackStatus || '').toLowerCase();
  if (status === 'success') return 'paid';
  if (['abandoned', 'cancelled'].includes(status)) return 'cancelled';
  if (['failed', 'reversed'].includes(status)) return 'failed';
  if (status === 'expired') return 'expired';
  return 'pending';
}

function entitlementResponse(entitlement, latestPayment = null) {
  const evaluated = CallEntitlement.evaluate(entitlement);
  return {
    ...evaluated,
    paymentStatus: latestPayment?.payment_status || (evaluated.access ? 'paid' : 'expired'),
    plan: evaluated.subscriptionPlan || latestPayment?.plan || null,
    subscriptionStartDate: evaluated.subscriptionStartAt || latestPayment?.subscription_start || null,
    subscriptionExpiryDate: evaluated.subscriptionExpiresAt || latestPayment?.subscription_expiry || null,
    daysRemaining: evaluated.daysRemaining,
  };
}

// Initialize only from the authenticated server-side account.
// The browser may select a plan, but it cannot choose the price.
router.post('/initialize', auth, async (req, res) => {
  try {
    if (!requirePaystack(res)) return;

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access required.' });
    }

    const plan = getCallSubscriptionPlan(req.body?.plan);
    if (!plan) return res.status(400).json({ error: 'Please select a valid subscription plan.' });

    const email = String(req.body?.email || req.user.email || '').trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (req.user.email && email !== String(req.user.email).trim().toLowerCase()) {
      return res.status(400).json({ error: 'Payment email must match your signed-in account email.' });
    }

    const configuredPlan = await fetchConfiguredPaystackPlan(plan);
    const reference = createReference();

    const payload = {
      email,
      currency: 'KES',
      reference,
      metadata: JSON.stringify({
        product: 'call_admin_subscription',
        plan: plan.code,
        user_id: req.user.id,
        amount_kes: plan.amountKes,
        months: plan.months,
      }),
      callback_url:
        process.env.PAYSTACK_CALL_ADMIN_CALLBACK_URL ||
        `${process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`}/client/settings.html`,
    };

    if (configuredPlan) {
      // When configured, Paystack owns the recurring billing schedule.
      // The server still validates the plan's amount/currency/interval above.
      payload.plan = configuredPlan.code;
    } else {
      // Supported fallback: a verified one-time payment that grants the
      // exact selected period. No fake recurring billing is created.
      payload.amount = String(plan.amountKes * 100);
    }

    const init = await axios.post(
      `${PAYSTACK_URL}/transaction/initialize`,
      payload,
      { headers: getPaystackHeaders(), timeout: 15000 }
    );

    const data = init.data?.data;
    if (!init.data?.status || !data?.access_code || !data?.authorization_url) {
      throw new Error('Paystack did not return a valid checkout session.');
    }

    await CallSubscription.create({
      userId: req.user.id,
      email,
      reference,
      planCode: plan.code,
    });

    res.json({
      success: true,
      reference,
      accessCode: data.access_code,
      authorizationUrl: data.authorization_url,
      plan: publicPlan(plan),
      recurring: Boolean(configuredPlan),
    });
  } catch (error) {
    console.error('Subscription initialize error:', error.response?.data || error.message);
    res.status(error.response?.status >= 400 && error.response?.status < 500 ? 400 : 500).json({
      error: error.response?.data?.message || error.message || 'Could not start the payment checkout.',
    });
  }
});

async function verifyAndFulfill(reference, expectedUserId = null) {
  const record = await CallSubscription.findByReference(reference);
  if (!record) {
    const error = new Error('Subscription payment record not found.');
    error.code = 'PAYMENT_NOT_FOUND';
    throw error;
  }

  if (expectedUserId && String(record.user_id) !== String(expectedUserId)) {
    const error = new Error('This payment does not belong to the signed-in account.');
    error.code = 'PAYMENT_OWNERSHIP';
    throw error;
  }

  const plan = getCallSubscriptionPlan(record.plan);
  if (!plan || Number(record.amount_kes) !== Number(plan.amountKes) || String(record.currency).toUpperCase() !== 'KES') {
    const error = new Error('Stored payment plan is invalid.');
    error.code = 'PAYMENT_PLAN_MISMATCH';
    throw error;
  }

  const tx = await verifyWithPaystack(reference);
  if (!tx || String(tx.reference) !== String(reference)) {
    const error = new Error('Paystack returned an invalid transaction reference.');
    error.code = 'PAYMENT_REFERENCE_MISMATCH';
    throw error;
  }

  const normalizedStatus = normalizePaymentStatus(tx.status);
  if (normalizedStatus !== 'paid') {
    if (normalizedStatus !== 'pending') {
      await CallSubscription.markPaymentStatus(reference, normalizedStatus);
    }
    return { paid: false, pending: normalizedStatus === 'pending', status: normalizedStatus, record, transaction: tx };
  }

  const amountOk = Number(tx.amount) === Number(plan.amountKes) * 100;
  const currencyOk = String(tx.currency || '').toUpperCase() === 'KES';
  if (!amountOk || !currencyOk) {
    await CallSubscription.markPaymentStatus(reference, 'failed');
    const error = new Error('Payment amount or currency could not be verified.');
    error.code = 'PAYMENT_AMOUNT_MISMATCH';
    throw error;
  }

  const fulfilled = await CallSubscription.fulfillPaidPayment(
    reference,
    Number.isFinite(Number(tx.id)) ? Number(tx.id) : null,
    tx.paid_at || tx.created_at || new Date().toISOString()
  );

  return {
    paid: true,
    pending: false,
    status: 'paid',
    record,
    transaction: tx,
    fulfillment: fulfilled,
  };
}

router.post('/verify', auth, async (req, res) => {
  try {
    if (!requirePaystack(res)) return;

    const reference = String(req.body?.reference || '').trim();
    if (!reference || !/^MTC-CALL-[A-Za-z0-9-]+$/.test(reference)) {
      return res.status(400).json({ error: 'Invalid Paystack reference.' });
    }

    const result = await verifyAndFulfill(reference, req.user.id);

    if (!result.paid) {
      return res.status(202).json({
        success: false,
        pending: result.pending,
        status: result.status,
        message: result.pending
          ? 'Payment is still being processed. Please wait a moment and check again.'
          : 'Payment was not successful. Please choose a plan and try again.',
      });
    }

    const entitlement = await CallEntitlement.get(req.user.id);
    res.json({
      success: true,
      message: 'Payment verified. Call Admin access is now active.',
      ...entitlementResponse(entitlement, result.record),
    });
  } catch (error) {
    console.error('Subscription verify error:', error.response?.data || error.message);
    const status = ['PAYMENT_OWNERSHIP', 'PAYMENT_NOT_FOUND', 'PAYMENT_REFERENCE_MISMATCH'].includes(error.code) ? 400 : 500;
    res.status(status).json({ error: error.message || 'Could not verify payment with Paystack.' });
  }
});

router.post('/webhook', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).send('Webhook not configured');

  const signature = String(req.headers['x-paystack-signature'] || '');
  const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');

  let validSignature = false;
  try {
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    validSignature = Boolean(signature) && a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    validSignature = false;
  }

  if (!validSignature) return res.status(401).send('Invalid signature');

  try {
    const event = String(req.body?.event || '').trim();
    const tx = req.body?.data || {};
    const reference = String(tx.reference || '').trim();

    if (event !== 'charge.success') {
      return res.status(200).send('Ignored');
    }

    if (!reference || !/^MTC-CALL-[A-Za-z0-9-]+$/.test(reference)) {
      return res.status(200).send('Ignored');
    }

    const record = await CallSubscription.findByReference(reference);
    if (!record) return res.status(200).send('Unknown reference');

    // Webhook fulfillment is independently verified against Paystack, rather
    // than trusting the webhook amount/status alone.
    const verified = await verifyAndFulfill(reference);
    if (!verified.paid) return res.status(400).send('Payment not verified');

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Subscription webhook error:', error.response?.data || error.message);
    return res.status(500).send('Webhook error');
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const entitlement = await CallEntitlement.get(req.user.id);
    const latestPayment = await CallSubscription.latestForUser(req.user.id);
    const evaluated = entitlementResponse(entitlement, latestPayment);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      plans: Object.values(CALL_SUBSCRIPTION_PLANS).map(publicPlan),
      ...evaluated,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
