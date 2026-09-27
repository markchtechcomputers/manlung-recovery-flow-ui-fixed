-- Manlung Remote Desktop: enrolled devices, consented sessions and WebRTC signaling.
-- Server-side code uses the Supabase service-role client after its own admin/device-token checks.
-- Public/authenticated Data API access is intentionally revoked; RLS is enabled as defense in depth.

create table if not exists public.remote_devices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text,
  device_name text not null,
  platform text not null check (platform in ('windows','macos','android','ios','linux','other')),
  enrollment_token_hash text not null unique,
  status text not null default 'online' check (status in ('online','offline','revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists remote_devices_owner_idx on public.remote_devices(owner_user_id);
create index if not exists remote_devices_status_idx on public.remote_devices(status);
create index if not exists remote_devices_last_seen_idx on public.remote_devices(last_seen_at);

create table if not exists public.remote_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.remote_devices(id) on delete cascade,
  admin_user_id text not null,
  status text not null default 'requested' check (status in ('requested','approved','rejected','active','ended','expired')),
  requested_audio boolean not null default false,
  approved_audio boolean not null default false,
  consented_at timestamptz,
  started_at timestamptz,
  expires_at timestamptz not null,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists remote_sessions_device_idx on public.remote_sessions(device_id);
create index if not exists remote_sessions_admin_idx on public.remote_sessions(admin_user_id);
create index if not exists remote_sessions_status_idx on public.remote_sessions(status);
create index if not exists remote_sessions_expires_idx on public.remote_sessions(expires_at);

create table if not exists public.remote_session_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.remote_sessions(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin','device')),
  event text not null check (event in ('offer','answer','ice-candidate','ready','stop')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists remote_signals_session_idx on public.remote_session_signals(session_id, id);

create table if not exists public.remote_audit_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.remote_sessions(id) on delete set null,
  device_id uuid references public.remote_devices(id) on delete set null,
  actor_user_id text,
  actor_type text not null check (actor_type in ('admin','device','system')),
  event_type text not null,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists remote_audit_session_idx on public.remote_audit_events(session_id);
create index if not exists remote_audit_device_idx on public.remote_audit_events(device_id);
create index if not exists remote_audit_created_idx on public.remote_audit_events(created_at desc);

alter table public.remote_devices enable row level security;
alter table public.remote_sessions enable row level security;
alter table public.remote_session_signals enable row level security;
alter table public.remote_audit_events enable row level security;

revoke all on table public.remote_devices from anon, authenticated;
revoke all on table public.remote_sessions from anon, authenticated;
revoke all on table public.remote_session_signals from anon, authenticated;
revoke all on table public.remote_audit_events from anon, authenticated;
