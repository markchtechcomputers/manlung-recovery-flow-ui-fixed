-- ============================================================
-- CLIENT EMAIL VERIFICATION
-- ============================================================
-- New client accounts must verify their email before login.
-- Existing authentication, OAuth, admin, and owner flows remain
-- unchanged.

alter table public.recovery_users
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verification_token_hash text,
  add column if not exists email_verification_expires timestamptz;

create index if not exists recovery_users_email_verification_token_idx
  on public.recovery_users(email_verification_token_hash);

comment on column public.recovery_users.email_verified_at is
  'Timestamp when the client email address was verified.';

comment on column public.recovery_users.email_verification_token_hash is
  'SHA-256 hash of the one-time email verification token.';

comment on column public.recovery_users.email_verification_expires is
  'Expiration timestamp for the email verification token.';
