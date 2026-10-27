-- Extend existing recovery payment/review tables without replacing prior data.
alter table public.recovery_service_payments
  add column if not exists package_name text not null default 'Standard Support',
  add column if not exists currency text not null default 'KES';
alter table public.recovery_service_payments
  drop constraint if exists recovery_service_payments_package_name_check;
alter table public.recovery_service_payments
  add constraint recovery_service_payments_package_name_check
  check (package_name in ('Basic Support','Standard Support','Premium Support'));
alter table public.recovery_service_payments
  drop constraint if exists recovery_service_payments_currency_check;
alter table public.recovery_service_payments
  add constraint recovery_service_payments_currency_check check (currency='KES');
create index if not exists recovery_service_payments_status_created_idx
  on public.recovery_service_payments(status,created_at desc);
alter table public.recovery_service_reviews enable row level security;
alter table public.recovery_service_payments enable row level security;
revoke all on public.recovery_service_payments from anon,authenticated;
revoke all on public.recovery_service_reviews from anon,authenticated;