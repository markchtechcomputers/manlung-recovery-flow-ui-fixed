-- Missing Call Admin tables
create extension if not exists pgcrypto;

create table if not exists public.recovery_admin_presence (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null unique references public.recovery_users(id) on delete cascade,
  is_online boolean not null default false,
  is_busy boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_call_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.recovery_users(id) on delete cascade,
  subscription_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_call_sessions (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.recovery_users(id) on delete cascade,
  client_name text,
  client_email text,
  case_id text,
  admin_user_id uuid references public.recovery_users(id) on delete set null,
  status text not null default 'ringing' check (status in ('ringing','accepted','ended','rejected','missed','failed')),
  ringing_started_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now()
);

create index if not exists recovery_admin_presence_online_idx on public.recovery_admin_presence(is_online, last_seen);
create index if not exists recovery_call_entitlements_user_idx on public.recovery_call_entitlements(user_id);
create index if not exists recovery_call_sessions_admin_status_idx on public.recovery_call_sessions(admin_user_id, status, accepted_at desc);
create index if not exists recovery_call_sessions_client_status_idx on public.recovery_call_sessions(client_user_id, status, created_at desc);
alter table public.recovery_admin_presence enable row level security;
alter table public.recovery_call_entitlements enable row level security;
alter table public.recovery_call_sessions enable row level security;
notify pgrst, 'reload schema';
