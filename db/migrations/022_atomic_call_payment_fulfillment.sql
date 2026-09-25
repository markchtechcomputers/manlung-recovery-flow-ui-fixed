create or replace function public.fulfill_recovery_call_payment(
  p_reference text,
  p_transaction_id bigint,
  p_payment_date timestamptz
)
returns table (
  processed boolean,
  user_id uuid,
  plan text,
  subscription_start timestamptz,
  subscription_expiry timestamptz
)
language plpgsql
set search_path = public
as $$
declare
  payment_row public.recovery_call_subscriptions%rowtype;
  entitlement_row public.recovery_call_entitlements%rowtype;
  months_to_add integer;
  start_at timestamptz;
  expiry_at timestamptz;
begin
  select * into payment_row
  from public.recovery_call_subscriptions
  where paystack_reference = p_reference
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if payment_row.payment_status = 'paid' then
    return query select false, payment_row.user_id, payment_row.plan,
      payment_row.subscription_start, payment_row.subscription_expiry;
    return;
  end if;

  months_to_add := case payment_row.plan
    when 'monthly' then 1
    when 'six_months' then 6
    when 'yearly' then 12
    else 0
  end;

  if months_to_add = 0 then raise exception 'INVALID_SUBSCRIPTION_PLAN'; end if;

  select * into entitlement_row
  from public.recovery_call_entitlements
  where user_id = payment_row.user_id
  for update;

  start_at := greatest(coalesce(entitlement_row.subscription_expires_at, now()), now());
  expiry_at := start_at + make_interval(months => months_to_add);

  update public.recovery_call_subscriptions
  set payment_status = 'paid',
      status = 'active',
      payment_date = coalesce(p_payment_date, now()),
      paystack_transaction_id = p_transaction_id,
      subscription_start = start_at,
      subscription_expiry = expiry_at,
      started_at = start_at,
      expires_at = expiry_at
  where paystack_reference = p_reference;

  insert into public.recovery_call_entitlements (
    user_id, subscription_plan, subscription_status,
    subscription_start_at, subscription_expires_at, updated_at
  )
  values (
    payment_row.user_id, payment_row.plan, 'active',
    start_at, expiry_at, now()
  )
  on conflict (user_id) do update
  set subscription_plan = excluded.subscription_plan,
      subscription_status = 'active',
      subscription_start_at = excluded.subscription_start_at,
      subscription_expires_at = excluded.subscription_expires_at,
      updated_at = now();

  return query select true, payment_row.user_id, payment_row.plan, start_at, expiry_at;
end;
$$;

revoke all on function public.fulfill_recovery_call_payment(text,bigint,timestamptz) from public;
grant execute on function public.fulfill_recovery_call_payment(text,bigint,timestamptz) to service_role;
