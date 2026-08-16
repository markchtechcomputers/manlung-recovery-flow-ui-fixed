const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const TABLE = 'recovery_donations';
const MIN_KES = 50;
const MAX_KES = 1000000;

function validationError(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

function validAmount(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= MIN_KES && amount <= MAX_KES;
}

router.post('/initialize', [
  body('amountKes').isInt({ min: MIN_KES, max: MAX_KES }).withMessage(`Donation must be between ${MIN_KES} and ${MAX_KES} KES`),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
], async (req, res) => {
  if (!validationError(req, res)) return;
  try {
    if (!process.env.PAYSTACK_SECRET_KEY || !process.env.PAYSTACK_PUBLIC_KEY) {
      return res.status(503).json({ error: 'Donations are not configured yet. Add PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY on the server.' });
    }

    const amountKes = Number(req.body.amountKes);
    const email = String(req.body.email).trim().toLowerCase();
    if (!validAmount(amountKes)) return res.status(400).json({ error: 'Invalid donation amount.' });

    const reference = `MTC-DONATE-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;

    const { error: insertError } = await supabase.from(TABLE).insert({
      reference,
      donor_email: email,
      amount_kes: amountKes,
      status: 'pending',
    });
    if (insertError) throw insertError;

    const init = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amountKes * 100,
        currency: 'KES',
        reference,
        metadata: { donation: true, amount_kes: amountKes },
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`}/donate.html`,
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.json({
      success: true,
      reference,
      accessCode: init.data?.data?.access_code,
      authorizationUrl: init.data?.data?.authorization_url,
      amountKes,
      amountKobo: amountKes * 100,
      email,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    console.error('Donation initialize error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not start the donation payment.' });
  }
});

router.post('/verify', [
  body('reference').trim().notEmpty().withMessage('Payment reference is required'),
], async (req, res) => {
  if (!validationError(req, res)) return;
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payment verification is not configured.' });
    }

    const reference = String(req.body.reference).trim();
    const { data: record, error: recordError } = await supabase
      .from(TABLE).select('*').eq('reference', reference).maybeSingle();
    if (recordError) throw recordError;
    if (!record) return res.status(404).json({ error: 'Donation record not found.' });

    if (record.status === 'confirmed') {
      return res.json({ success: true, alreadyConfirmed: true, amountKes: record.amount_kes });
    }

    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const tx = verify.data?.data;
    const paidOk = tx?.status === 'success';
    const amountOk = Number(tx?.amount) === Number(record.amount_kes) * 100;
    const currencyOk = String(tx?.currency || '').toUpperCase() === 'KES';

    if (!amountOk || !currencyOk) {
      await supabase.from(TABLE).update({ status: 'failed' }).eq('reference', reference).eq('status', 'pending');
      return res.status(400).json({ error: 'Payment amount or currency could not be verified.' });
    }

    if (!paidOk) {
      // Do not mark an in-progress Paystack transaction as failed. This is
      // important for M-PESA/OTP/transfer flows that can remain pending.
      return res.status(202).json({ success: false, pending: true, status: tx?.status || 'pending' });
    }

    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
.update(markConfirmedFromTransaction(tx))
      .eq('reference', reference)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (updateError) throw updateError;

    if (!updated) {
      const { data: latest } = await supabase.from(TABLE).select('status, amount_kes').eq('reference', reference).maybeSingle();
      if (latest?.status === 'confirmed') return res.json({ success: true, alreadyConfirmed: true, amountKes: Number(latest.amount_kes) });
    }
    res.json({ success: true, amountKes: Number(updated?.amount_kes || record.amount_kes) });
  } catch (error) {
    console.error('Donation verify error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not verify the donation right now.' });
  }
});



function markConfirmedFromTransaction(tx) {
  return {
    status: 'confirmed',
    paystack_transaction_id: String(tx?.id || ''),
    paid_at: tx?.paid_at || tx?.transaction_date || new Date().toISOString(),
  };
}

// Paystack webhook: confirms successful payments even if the donor closes the
// browser before the frontend callback runs. Signature is verified with the
// Paystack secret key before any database update is made.
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

    const event = req.body || {};
    if (event.event !== 'charge.success') return res.status(200).send('Ignored');

    const tx = event.data || {};
    const reference = String(tx.reference || '').trim();
    if (!reference) return res.status(400).send('Missing reference');

    const { data: record, error: recordError } = await supabase
      .from(TABLE).select('*').eq('reference', reference).maybeSingle();
    if (recordError) throw recordError;
    if (!record) return res.status(200).send('Unknown reference');

    const amountOk = Number(tx.amount) === Number(record.amount_kes) * 100;
    const currencyOk = String(tx.currency || '').toUpperCase() === 'KES';
    if (tx.status !== 'success' || !amountOk || !currencyOk) return res.status(400).send('Payment mismatch');

    const { error: updateError } = await supabase
      .from(TABLE)
      .update(markConfirmedFromTransaction(tx))
      .eq('reference', reference)
      .neq('status', 'confirmed');
    if (updateError) throw updateError;

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Donation webhook error:', error.response?.data || error.message);
    return res.status(500).send('Webhook error');
  }
});

// Public aggregate only. No donor PII is exposed.
router.get('/total', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE).select('amount_kes').eq('status', 'confirmed');
    if (error) throw error;
    const rows = data || [];
    const totalKes = rows.reduce((sum, row) => sum + Number(row.amount_kes || 0), 0);
    res.json({ success: true, totalKes, donationCount: rows.length });
  } catch (error) {
    console.error('Donation total error:', error);
    res.status(500).json({ error: 'Could not load donation total.' });
  }
});

// Admin dashboard: totals plus recent confirmed donations.
router.get('/admin', adminAuth, async (_req, res) => {
  try {
    const { data: confirmedRows, error: confirmedError } = await supabase
      .from(TABLE)
      .select('reference, donor_email, amount_kes, status, paid_at, created_at')
      .eq('status', 'confirmed')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1);
    if (confirmedError) throw confirmedError;

    const { data: totalsRows, error: totalsError } = await supabase
      .from(TABLE)
      .select('amount_kes')
      .eq('status', 'confirmed');
    if (totalsError) throw totalsError;

    const rows = confirmedRows || [];
    const totalKes = (totalsRows || [])
      .reduce((sum, row) => sum + Number(row.amount_kes || 0), 0);
    const confirmedCount = (totalsRows || []).length;

    // The Admin portal intentionally shows only the newest confirmed donor.
    // Older donor details are not retained in the visible Admin table.
    res.json({ success: true, totalKes, confirmedCount, donations: rows });
  } catch (error) {
    console.error('Admin donations error:', error);
    res.status(500).json({ error: 'Could not load donations.' });
  }
});

module.exports = router;
