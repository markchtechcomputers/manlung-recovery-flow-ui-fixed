-- Manlung Remote Desktop hardening.
-- Separate one-time enrollment credentials from long-lived device credentials,
-- expire enrollment tokens, prevent concurrent control sessions per device,
-- and make revocation terminate pending/active sessions.

alter table public.remote_devices
  alter column enrollment_token_hash drop not null;

alter table public.remote_devices
  add column if not exists device_token_hash text,
  add column if not exists enrollment_expires_at timestamptz;

-- Existing enrolled devices from the first implementation stored their device
-- token hash in enrollment_token_hash. Preserve those credentials while
-- separating future enrollment tokens from device tokens.
update public.remote_devices
set device_token_hash = enrollment_token_hash,
    enrollment_token_hash = null,
    enrollment_expires_at = null
where status = 'online'
  and device_token_hash is null
  and enrollment_token_hash is not null;

create unique index if not exists remote_devices_device_token_hash_uidx
  on public.remote_devices(device_token_hash)
  where device_token_hash is not null;

create index if not exists remote_devices_enrollment_expires_idx
  on public.remote_devices(enrollment_expires_at);

-- A device can have at most one pending/approved/active remote-control
-- session. This prevents two admins from racing to control the same device.
create unique index if not exists remote_sessions_one_live_per_device_uidx
  on public.remote_sessions(device_id)
  where status in ('requested','approved','active');

-- Revoke any sessions that were left live before this hardening migration.
update public.remote_sessions s
set status = 'ended',
    ended_at = now(),
    end_reason = 'device_revoked',
    updated_at = now()
from public.remote_devices d
where s.device_id = d.id
  and d.status = 'revoked'
  and s.status in ('requested','approved','active');

-- Do not expose remote-control tables through the browser Data API.
alter table public.remote_devices enable row level security;
alter table public.remote_sessions enable row level security;
alter table public.remote_session_signals enable row level security;
alter table public.remote_audit_events enable row level security;

revoke all on table public.remote_devices from anon, authenticated;
revoke all on table public.remote_sessions from anon, authenticated;
revoke all on table public.remote_session_signals from anon, authenticated;
revoke all on table public.remote_audit_events from anon, authenticated;
