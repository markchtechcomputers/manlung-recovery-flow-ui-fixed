alter table public.recovery_users
  add column if not exists email_otp_required boolean not null default false;

create index if not exists recovery_users_email_otp_required_idx
  on public.recovery_users(email_otp_required);

comment on column public.recovery_users.email_otp_required is
  'Whether this client account must complete Supabase Auth email OTP verification before login.';
