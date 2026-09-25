const { supabase } = require('../config/supabase');

const TABLE = 'recovery_call_entitlements';

async function get(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data && data.subscription_status === 'active' && data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() <= Date.now()) {
    const { data: expired, error: updateError } = await supabase
      .from(TABLE)
      .update({ subscription_status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    if (!updateError) return expired;
  }
  return data;
}

function evaluate(entitlement, nowMs = Date.now()) {
  const expiryMs = entitlement?.subscription_expires_at
    ? new Date(entitlement.subscription_expires_at).getTime()
    : 0;
  const freeExpiryMs = entitlement?.free_access_until
    ? new Date(entitlement.free_access_until).getTime()
    : 0;
  const free = Boolean(freeExpiryMs > nowMs);
  const active = Boolean(
    entitlement &&
    entitlement.subscription_status === 'active' &&
    expiryMs > nowMs
  );

  return {
    access: active || free,
    status: active || free ? 'active' : 'expired',
    subscription: active,
    free,
    subscriptionPlan: active ? (entitlement.subscription_plan || null) : (entitlement?.subscription_plan || null),
    subscriptionStartAt: entitlement?.subscription_start_at || null,
    subscriptionExpiresAt: entitlement?.subscription_expires_at || null,
    daysRemaining: Math.max(
      active ? Math.ceil((expiryMs - nowMs) / 86400000) : 0,
      free ? Math.ceil((freeExpiryMs - nowMs) / 86400000) : 0
    ),
    trial: false,
    trialAvailable: false,
    trialUsed: Boolean(entitlement?.trial_started_at),
    free: false,
  };
}

module.exports = {
  get,
  evaluate,
};
