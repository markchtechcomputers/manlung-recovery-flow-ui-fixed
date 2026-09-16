const { supabase } = require('../config/supabase');

const TABLE = 'recovery_call_subscriptions';
const SUBSCRIPTION_DAYS = 30;

async function create({ userId, email, reference, amountKes }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, email, paystack_reference: reference, amount_kes: amountKes, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findByReference(reference) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('paystack_reference', reference).maybeSingle();
  if (error) throw error;
  return data;
}

async function activate(reference) {
  const now = new Date();
  const expires = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'active', started_at: now.toISOString(), expires_at: expires.toISOString() })
    .eq('paystack_reference', reference)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function markFailed(reference) {
  const { error } = await supabase.from(TABLE).update({ status: 'failed' }).eq('paystack_reference', reference);
  if (error) throw error;
}

// The most recent subscription for a user, regardless of status
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

function isActive(subscription) {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.expires_at) return false;
  return new Date(subscription.expires_at).getTime() > Date.now();
}

module.exports = { create, findByReference, activate, markFailed, latestForUser, isActive, SUBSCRIPTION_DAYS };
