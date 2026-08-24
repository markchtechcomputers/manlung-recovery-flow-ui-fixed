const { supabase } = require('../config/supabase');

const TABLE = 'recovery_call_entitlements';
const SUBSCRIPTION_DAYS = 30;

// ---- Global launch trial window ----
// This is a ONE-TIME, GLOBAL promotional window — NOT a per-user trial tied
// to registration date. Every client (new or existing) gets free Call Admin
// access during this window, and every client loses free access at the same
// moment when it ends. There is no per-user "2 days from signup" logic here
// at all — that was the old model and has been fully replaced.
//
// Africa/Nairobi (EAT) is a fixed UTC+3 offset with NO daylight saving time
// (confirmed year-round, not just assumed) — so these can be safely
// hardcoded as UTC instants rather than computed with a timezone library:
//   2026-08-12 00:00:00 Africa/Nairobi  ==  2026-08-11T21:00:00.000Z
//   2026-08-25 23:59:59.999 Africa/Nairobi  ==  2026-08-25T20:59:59.999Z

async function get(userId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Flat 30 days from the moment of verified payment — not additive on top of
// remaining time, matching the spec's worked example exactly.
async function activateSubscription(userId, subscriptionDays = SUBSCRIPTION_DAYS) {
  const days = Number(subscriptionDays);
  if (![30, 90, 180, 365].includes(days)) {
    throw new Error('Invalid subscription duration.');
  }

  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, subscription_expires_at: expires.toISOString(), updated_at: now.toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Server-side time only — never trusts a client-supplied "now". The launch
// trial check uses the server clock exclusively; there is no code path
// anywhere that reads a client-provided date for this decision.
//
// Priority, matching the spec exactly:
//   1. Active global launch trial -> access granted
//   2. Active paid subscription   -> access granted
//   3. Neither                    -> access denied
function evaluate(entitlement, nowMs = Date.now()) {
  const subscriptionExpiresAt =
    entitlement?.subscription_expires_at
      ? new Date(entitlement.subscription_expires_at).getTime()
      : 0;

  const subscriptionActive =
    subscriptionExpiresAt > nowMs;

  const hadSubscriptionBefore =
    !!entitlement?.subscription_expires_at;

  let status;

  if (subscriptionActive) {
    status = 'active';
  } else if (hadSubscriptionBefore) {
    status = 'expired';
  } else {
    status = 'subscription_required';
  }

  return {
    access: subscriptionActive,
    status,
    trial: false,
    trialWindow: null,
    subscription: subscriptionActive,
    subscriptionExpiresAt:
      entitlement?.subscription_expires_at || null,
  };
}

module.exports = {
  get, activateSubscription, evaluate,
  SUBSCRIPTION_DAYS,
};
