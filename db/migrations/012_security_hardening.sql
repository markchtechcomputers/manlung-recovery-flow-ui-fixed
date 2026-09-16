-- Security hardening for recovery_users.
-- Run this migration in Supabase SQL Editor before deploying the new backend.

alter table public.recovery_users
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists login_locked_until timestamptz,
  add column if not exists last_login_at timestamptz;

alter table public.recovery_users
  drop constraint if exists recovery_users_failed_login_attempts_check;

alter table public.recovery_users
  add constraint recovery_users_failed_login_attempts_check
  check (failed_login_attempts between 0 and 3);

create index if not exists recovery_users_login_locked_until_idx
  on public.recovery_users (login_locked_until)
  where login_locked_until is not null;

-- Prevent browser/public Supabase roles from reading or modifying the
-- credential table. The backend uses the service_role key, which bypasses RLS.
alter table public.recovery_users enable row level security;

revoke all on table public.recovery_users from anon, authenticated;

-- Keep the service role as the only application data-access path.
-- Do not grant service_role explicitly here; Supabase owns that role.

comment on column public.recovery_users.failed_login_attempts is
  'Consecutive failed login attempts; backend locks the account at 3.';
comment on column public.recovery_users.login_locked_until is
  'Temporary account lock expiration after repeated failed login attempts.';
comment on column public.recovery_users.last_login_at is
  'Timestamp of the last successful password login.';
