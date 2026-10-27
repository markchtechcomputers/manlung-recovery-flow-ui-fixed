const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const router = express.Router();
const TABLE = 'recovery_service_payments';
const ALLOWED = new Set([200, 500, 1000]);

router.post('/initialize', async (req, res) => {
  try {
    const amountKes = Number(req.body?.amountKes);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const customerName = String(req.body?.customerName || '').trim().slice(0, 120);
    if (!ALLOWED.has(amountKes)) return res.status(400).json({ error: 'Choose a listed service package.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!process.env.PAYSTACK_SECRET_KEY || !process.env.PAYSTACK_PUBLIC_KEY) return res.status(503).json({ error: 'Paystack is not configured. Please contact support.' });
    const reference = 'MRS-' + Date.now() + '-' + crypto.randomBytes(5).toString('hex');
    const { error } = await supabase.from(TABLE).insert({ reference, email, customer_name: customerName || null, amount_kes: amountKes, status: 'pending' });
    if (error) throw error;
    const init = await axios.post('https://api.paystack.co/transaction/initialize', {
      email, amount: amountKes * 100, currency: 'KES', reference,
      metadata: { service_payment: true, customer_name: customerName || null, amount_kes: amountKes },
      callback_url: process.env.SERVICE_PAYMENT_CALLBACK_URL || `${process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`}/services.html`
    }, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    res.json({ success: true, reference, authorizationUrl: init.data?.data?.authorization_url, accessCode: init.data?.data?.access_code, publicKey: process.env.PAYSTACK_PUBLIC_KEY });
  } catch (error) {
    console.error('Service payment initialize error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to start payment. Please try again or contact support.' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const reference = String(req.body?.reference || '').trim();
    if (!/^MRS-[A-Za-z0-9-]+$/.test(reference)) return res.status(400).json({ error: 'Invalid payment reference.' });
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Payment verification is not configured.' });
    const { data: record, error } = await supabase.from(TABLE).select('*').eq('reference', reference).maybeSingle();
    if (error) throw error;
    if (!record) return res.status(404).json({ error: 'Payment reference not found.' });
    if (record.status === 'confirmed') return res.json({ success: true, reference, amountKes: record.amount_kes, email: record.email, reviewSubmitted: Boolean(record.review_submitted_at) });
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const tx = response.data?.data;
    if (Number(tx?.amount) !== Number(record.amount_kes) * 100 || String(tx?.currency).toUpperCase() !== 'KES') return res.status(400).json({ error: 'Payment amount or currency could not be verified.' });
    if (tx?.status !== 'success') return res.status(202).json({ success: false, pending: true, status: tx?.status || 'pending' });
    const { error: updateError } = await supabase.from(TABLE).update({ status: 'confirmed', paystack_transaction_id: String(tx.id || ''), paid_at: tx.paid_at || tx.transaction_date || new Date().toISOString() }).eq('reference', reference).eq('status', 'pending');
    if (updateError) throw updateError;
    res.json({ success: true, reference, amountKes: record.amount_kes, email: record.email, reviewSubmitted: false });
  } catch (error) {
    console.error('Service payment verify error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to verify payment right now.' });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const reference = String(req.body?.reference || '').trim();
    const customerName = String(req.body?.customerName || '').trim().slice(0, 80);
    const rating = Number(req.body?.rating);
    const review = String(req.body?.review || '').trim().slice(0, 1200);
    if (!reference || !customerName || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Please enter your name, rating, and review.' });
    const { data: payment, error } = await supabase.from(TABLE).select('reference,status,review_submitted_at').eq('reference', reference).maybeSingle();
    if (error) throw error;
    if (!payment || payment.status !== 'confirmed') return res.status(403).json({ error: 'A verified service payment is required before submitting a review.' });
    if (payment.review_submitted_at) return res.status(409).json({ error: 'A review has already been submitted for this payment.' });
    const { error: insertError } = await supabase.from('recovery_service_reviews').insert({ payment_reference: reference, customer_name: customerName, rating, review, is_public: true });
    if (insertError) throw insertError;
    const { error: updateError } = await supabase.from(TABLE).update({ review_submitted_at: new Date().toISOString() }).eq('reference', reference).is('review_submitted_at', null);
    if (updateError) throw updateError;
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Service review submit error:', error.message);
    res.status(500).json({ error: 'Unable to submit your review right now.' });
  }
});

router.get('/reviews', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('recovery_service_reviews').select('id,customer_name,rating,review,created_at').eq('is_public', true).order('created_at', { ascending: false }).limit(12);
    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (error) {
    console.error('Service reviews list error:', error.message);
    res.status(500).json({ error: 'Reviews are temporarily unavailable.' });
  }
});

module.exports = router;
