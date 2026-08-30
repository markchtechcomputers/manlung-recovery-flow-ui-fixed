-- Owner/Admin MFA hardening.
alter table recovery_users
  add column if not exists mfa_enabled boolean not null default false,
  add column if not exists mfa_secret text,
  add column if not exists mfa_recovery_code_hashes text[] not null default '{}';

create index if not exists recovery_users_mfa_enabled_idx
  on recovery_users (mfa_enabled)
  where mfa_enabled = true;
