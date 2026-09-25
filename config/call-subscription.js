const CALL_SUBSCRIPTION_PLANS = Object.freeze({
  monthly: Object.freeze({
    code: 'monthly',
    label: 'MONTHLY',
    amountKes: 300,
    billingLabel: 'per month',
    interval: 'monthly',
    months: 1,
    paystackPlanEnv: 'PAYSTACK_PLAN_MONTHLY',
  }),
  six_months: Object.freeze({
    code: 'six_months',
    label: '6 MONTHS',
    amountKes: 1800,
    billingLabel: 'for 6 months',
    interval: 'biannually',
    months: 6,
    paystackPlanEnv: 'PAYSTACK_PLAN_SIX_MONTHS',
  }),
  yearly: Object.freeze({
    code: 'yearly',
    label: '1 YEAR',
    amountKes: 3240,
    normalAmountKes: 3600,
    discountPercent: 10,
    billingLabel: 'for 1 year',
    interval: 'annually',
    months: 12,
    paystackPlanEnv: 'PAYSTACK_PLAN_YEARLY',
  }),
});

function getCallSubscriptionPlan(code) {
  return CALL_SUBSCRIPTION_PLANS[String(code || '').trim()] || null;
}

module.exports = {
  CALL_SUBSCRIPTION_PLANS,
  getCallSubscriptionPlan,
};
