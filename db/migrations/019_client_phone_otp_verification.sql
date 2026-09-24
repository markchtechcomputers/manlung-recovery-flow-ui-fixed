alter table public.recovery_users
  add column if not exists phone_verification_required boolean not null default false;

create index if not exists recovery_users_phone_verification_required_idx
  on public.recovery_users(phone_verification_required);

comment on column public.recovery_users.phone_verification_required is
  'Whether this client account must complete Supabase SMS OTP phone verification before login.';