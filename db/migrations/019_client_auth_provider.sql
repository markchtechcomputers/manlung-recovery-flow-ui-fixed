alter table public.recovery_users
  add column if not exists auth_provider text;

create index if not exists recovery_users_auth_provider_idx
  on public.recovery_users(auth_provider);

comment on column public.recovery_users.auth_provider is
  'Authentication method used for the client account: password, google, github, or other supported OAuth provider.';
