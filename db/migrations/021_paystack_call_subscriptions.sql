alter table public.recovery_call_subscriptions
  add column if not exists plan text,
  add column if not exists currency text not null default 'KES',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_date timestamptz,
  add column if not exists subscription_start timestamptz,
  add column if not exists subscription_expiry timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists paystack_transaction_id bigint;

update public.recovery_call_subscriptions
set payment_status = case
  when status = 'active' then 'paid'
  when status in ('failed','cancelled','expired') then status
  else 'pending'
end
where payment_status is null or payment_status = 'pending';

alter table public.recovery_call_subscriptions
  drop constraint if exists recovery_call_subscriptions_payment_status_check;
alter table public.recovery_call_subscriptions
  add constraint recovery_call_subscriptions_payment_status_check
  check (payment_status in ('pending','paid','failed','cancelled','expired'));

create unique index if not exists recovery_call_subscriptions_paystack_reference_uidx
  on public.recovery_call_subscriptions(paystack_reference);

alter table public.recovery_call_entitlements
  add column if not exists subscription_plan text,
  add column if not exists subscription_status text not null default 'expired',
  add column if not exists subscription_start_at timestamptz;

alter table public.recovery_call_entitlements
  drop constraint if exists recovery_call_entitlements_subscription_status_check;
alter table public.recovery_call_entitlements
  add constraint recovery_call_entitlements_subscription_status_check
  check (subscription_status in ('active','expired'));

update public.recovery_call_entitlements
set subscription_status = case
  when subscription_expires_at is not null and subscription_expires_at > now() then 'active'
  else 'expired'
end;

create or replace function public.touch_recovery_call_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recovery_call_subscription_updated_at on public.recovery_call_subscriptions;
create trigger recovery_call_subscription_updated_at
before update on public.recovery_call_subscriptions
for each row execute function public.touch_recovery_call_subscription();
