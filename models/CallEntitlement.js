const { supabase } = require('../config/supabase');

const TABLE = 'recovery_call_entitlements';
const SUBSCRIPTION_DAYS = 30;

// Global launch trial:
// 2026-08-12 00:00:00 EAT -> 2026-08-25 23:59:59.999 EAT
const LAUNCH_TRIAL_START = Date.parse('2026-08-11T21:00:00.000Z');
const LAUNCH_TRIAL_END = Date.parse('2026-08-25T20:59:59.999Z');

async function get(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function activateSubscription(userId, subscriptionDays = SUBSCRIPTION_DAYS) {
  const days = Number(subscriptionDays);

  if (![30, 90, 180, 365].includes(days)) {
    throw new Error('Invalid subscription duration.');
  }

  const now = new Date();
  const expires = new Date(
    now.getTime() + days * 24 * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        subscription_expires_at: expires.toISOString(),
        updated_at: now.toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

function isLaunchTrialActive(nowMs = Date.now()) {
  return nowMs >= LAUNCH_TRIAL_START && nowMs <= LAUNCH_TRIAL_END;
}

function evaluate(entitlement, nowMs = Date.now()) {
  // Call Admin is now free. Keep the existing entitlement columns and
  // subscription helpers for backward compatibility with existing data, but
  // access is no longer gated by a payment or trial window.
  const subscriptionExpiresAt = entitlement?.subscription_expires_at
    ? new Date(entitlement.subscription_expires_at).getTime()
    : 0;
  const subscriptionActive = subscriptionExpiresAt > nowMs;

  return {
    access: true,
    status: 'free',
    trial: false,
    trialAvailable: false,
    trialUsed: !!entitlement?.trial_used_at,
    subscription: subscriptionActive,
    subscriptionExpiresAt: entitlement?.subscription_expires_at || null,
    free: true,
  };
}


module.exports = {
  get,
  activateSubscription,
  evaluate,
  isLaunchTrialActive,
  SUBSCRIPTION_DAYS
};
