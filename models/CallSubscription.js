const { supabase } = require('../config/supabase');
const { getCallSubscriptionPlan } = require('../config/call-subscription');

const TABLE = 'recovery_call_subscriptions';

async function create({ userId, email, reference, planCode }) {
  const plan = getCallSubscriptionPlan(planCode);
  if (!plan) throw new Error('Invalid subscription plan.');

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      email,
      paystack_reference: reference,
      plan: plan.code,
      amount_kes: plan.amountKes,
      currency: 'KES',
      payment_status: 'pending',
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function findByReference(reference) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markPaymentStatus(reference, paymentStatus) {
  const allowed = ['pending', 'paid', 'failed', 'cancelled', 'expired'];
  if (!allowed.includes(paymentStatus)) throw new Error('Invalid payment status.');

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      payment_status: paymentStatus,
      status: paymentStatus === 'paid' ? 'active' : paymentStatus,
    })
    .eq('paystack_reference', reference)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fulfillPaidPayment(reference, transactionId, paymentDate) {
  const { data, error } = await supabase.rpc('fulfill_recovery_call_payment', {
    p_reference: reference,
    p_transaction_id: transactionId || null,
    p_payment_date: paymentDate || new Date().toISOString(),
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

async function latestForUser(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findByReference,
  markPaymentStatus,
  fulfillPaidPayment,
  latestForUser,
};
