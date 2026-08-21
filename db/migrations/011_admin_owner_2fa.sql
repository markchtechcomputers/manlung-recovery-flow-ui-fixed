alter table recovery_users
  add column if not exists two_factor_enabled boolean not null default false;

alter table recovery_users
  add column if not exists two_factor_secret_enc text;

alter table recovery_users
  add column if not exists two_factor_recovery_codes jsonb;

create index if not exists recovery_users_two_factor_idx
  on recovery_users(two_factor_enabled);
