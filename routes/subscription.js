const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const CallSubscription = require('../models/CallSubscription');
const CallEntitlement = require('../models/CallEntitlement');

const SUBSCRIPTION_AMOUNT_KES = 100;

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// Step 1: client asks us for a reference before opening the Paystack popup.
// We generate it server-side (not trusting the browser) and record a
// "pending" row so we have something to reconcile against later.
router.post('/initialize', auth, async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY || !process.env.PAYSTACK_PUBLIC_KEY) {
      return res.status(503).json({ error: 'Payment service is not configured on the server.' });
    }
    const reference = `MTC-CALL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Initialize on the server first. This gives Popup V2 an access_code
    // that is tied to the exact server-created reference/amount instead of
    // asking the browser to create the transaction itself.
    const init = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: SUBSCRIPTION_AMOUNT_KES * 100,
        currency: 'KES',
        reference,
        metadata: { call_admin_subscription: true, amount_kes: SUBSCRIPTION_AMOUNT_KES, user_id: req.user.id },
        callback_url: process.env.PAYSTACK_CALL_ADMIN_CALLBACK_URL ||
          `${process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`}/`,
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const paystackData = init.data?.data;
    if (!init.data?.status || !paystackData?.access_code) {
      throw new Error('Paystack did not return a checkout access code.');
    }

    await CallSubscription.create({
      userId: req.user.id,
      email: req.user.email,
      reference,
      amountKes: SUBSCRIPTION_AMOUNT_KES,
    });

    res.json({
      success: true,
      reference,
      accessCode: paystackData.access_code,
      authorizationUrl: paystackData.authorization_url || null,
      email: req.user.email,
      amountKes: SUBSCRIPTION_AMOUNT_KES,
      amountKobo: SUBSCRIPTION_AMOUNT_KES * 100,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    const paystackMessage = error.response?.data?.message;
    console.error('Subscription initialize error:', error.response?.data || error.message);
    res.status(error.response?.status >= 400 && error.response?.status < 500 ? 400 : 500).json({
      error: paystackMessage || 'Could not start the payment checkout. Please try again.'
    });
  }
});

// Step 2: after the Paystack popup reports success, the browser sends us the
// reference. We NEVER trust the browser's word alone — we re-verify directly
// with Paystack's API using our secret key before activating anything.
//
// Renewal model: the client-side Call Admin widget automatically opens the
// KES 100 checkout when the free trial has expired. Paystack still controls
// the payment confirmation; this does not silently charge a saved card.
router.post(
  '/verify',
  auth,
  [body('reference').trim().notEmpty().withMessage('Reference is required')],
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    try {
      const { reference } = req.body;

      const record = await CallSubscription.findByReference(reference);
      if (!record || record.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Subscription record not found' });
      }

      const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });

      const paystackData = verifyRes.data?.data;
      const paidOk = paystackData?.status === 'success';
      const amountOk = paystackData?.amount === record.amount_kes * 100;
      const currencyOk = String(paystackData?.currency || '').toUpperCase() === 'KES';

      if (!amountOk || !currencyOk) {
        await CallSubscription.markFailed(reference);
        return res.status(400).json({ error: 'Payment amount or currency could not be verified.' });
      }

      if (!paidOk) {
        // Paystack can legitimately report pending/ongoing/processing while
        // the customer is completing OTP, transfer or another payment step.
        // Do not permanently mark the record failed during that window.
        return res.status(202).json({ success: false, pending: true, status: paystackData?.status || 'pending' });
      }

      await CallSubscription.activate(reference);
      const entitlement = await CallEntitlement.activateSubscription(req.user.id);

      res.json({
        success: true,
        ...CallEntitlement.evaluate(entitlement),
      });
    } catch (error) {
      console.error('Subscription verify error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Could not verify payment with Paystack. Please try again shortly.' });
    }
  }
);

// Paystack webhook for Call Admin subscriptions. The webhook is a backup
// confirmation path if the user completes payment but closes the browser
// before the Popup success callback can call /verify.
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(503).send('Webhook not configured');

    const signature = String(req.headers['x-paystack-signature'] || '');
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (!signature || sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return res.status(401).send('Invalid signature');
    }

    if (req.body?.event !== 'charge.success') return res.status(200).send('Ignored');

    const tx = req.body?.data || {};
    const reference = String(tx.reference || '').trim();
    if (!reference || !reference.startsWith('MTC-CALL-')) return res.status(200).send('Ignored');

    const record = await CallSubscription.findByReference(reference);
    if (!record) return res.status(200).send('Unknown reference');

    const amountOk = Number(tx.amount) === Number(record.amount_kes) * 100;
    const currencyOk = String(tx.currency || '').toUpperCase() === 'KES';
    if (tx.status !== 'success' || !amountOk || !currencyOk) return res.status(400).send('Payment mismatch');

    await CallSubscription.activate(reference);
    await CallEntitlement.activateSubscription(record.user_id);
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Subscription webhook error:', error.response?.data || error.message);
    return res.status(500).send('Webhook error');
  }
});

// Response shape: { access, status, trial, trialWindow: {start, end},
// subscription, subscriptionExpiresAt }. Also mounted at
// /api/payments/call-admin/status (see server.js) for spec compatibility.
router.get('/status', auth, async (req, res) => {
  try {
    const entitlement = await CallEntitlement.get(req.user.id);
    res.json({ success: true, amountKes: SUBSCRIPTION_AMOUNT_KES, ...CallEntitlement.evaluate(entitlement) });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
