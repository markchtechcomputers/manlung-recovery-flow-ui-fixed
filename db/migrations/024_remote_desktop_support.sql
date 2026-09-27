-- Manlung Remote Desktop / Remote Support
-- Final schema for authorized device enrollment, consented sessions,
-- WebRTC signaling, and audit events.
--
-- All access is performed by the Node backend after its own admin/device
-- authentication checks. Browser Data API access is intentionally revoked.

create extension if not exists pgcrypto;

create table if not exists public.remote_devices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text,
  device_name text not null,
  platform text not null check (platform in ('windows','macos','android','ios','linux','other')),
  enrollment_token_hash text,
  device_token_hash text,
  enrollment_expires_at timestamptz,
  status text not null default 'offline' check (status in ('online','offline','revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.remote_devices
  alter column enrollment_token_hash drop not null;

alter table public.remote_devices
  add column if not exists device_token_hash text,
  add column if not exists enrollment_expires_at timestamptz;

create index if not exists remote_devices_owner_idx on public.remote_devices(owner_user_id);
create index if not exists remote_devices_status_idx on public.remote_devices(status);
create index if not exists remote_devices_last_seen_idx on public.remote_devices(last_seen_at);
create index if not exists remote_devices_enrollment_expires_idx on public.remote_devices(enrollment_expires_at);
create unique index if not exists remote_devices_enrollment_token_uidx
  on public.remote_devices(enrollment_token_hash)
  where enrollment_token_hash is not null;
create unique index if not exists remote_devices_device_token_uidx
  on public.remote_devices(device_token_hash)
  where device_token_hash is not null;

-- Compatibility for the first remote-desktop implementation, which stored
-- enrolled device hashes in enrollment_token_hash.
update public.remote_devices
set device_token_hash = enrollment_token_hash,
    enrollment_token_hash = null,
    enrollment_expires_at = null
where status = 'online'
  and device_token_hash is null
  and enrollment_token_hash is not null;

create table if not exists public.remote_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.remote_devices(id) on delete cascade,
  admin_user_id text not null,
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','active','ended','expired')),
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
create unique index if not exists remote_sessions_one_live_per_device_uidx
  on public.remote_sessions(device_id)
  where status in ('requested','approved','active');

create table if not exists public.remote_session_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.remote_sessions(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin','device')),
  event text not null check (event in ('offer','answer','ice-candidate','ready','stop')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists remote_signals_session_idx
  on public.remote_session_signals(session_id, id);

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

update public.remote_sessions s
set status = 'ended',
    ended_at = now(),
    end_reason = 'device_revoked',
    updated_at = now()
from public.remote_devices d
where s.device_id = d.id
  and d.status = 'revoked'
  and s.status in ('requested','approved','active');

alter table public.remote_devices enable row level security;
alter table public.remote_sessions enable row level security;
alter table public.remote_session_signals enable row level security;
alter table public.remote_audit_events enable row level security;

revoke all on table public.remote_devices from anon, authenticated;
revoke all on table public.remote_sessions from anon, authenticated;
revoke all on table public.remote_session_signals from anon, authenticated;
revoke all on table public.remote_audit_events from anon, authenticated;
