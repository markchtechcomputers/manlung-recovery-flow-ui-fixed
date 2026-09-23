create table if not exists public.recovery_location_points (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  client_user_id uuid not null,
  device_id text not null,
  device_label text not null default 'My device',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  altitude_m double precision,
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  heading_deg double precision check (heading_deg is null or (heading_deg >= 0 and heading_deg < 360)),
  battery_percent smallint check (battery_percent is null or battery_percent between 0 and 100),
  device_timestamp timestamptz not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists recovery_location_points_case_received_idx
  on public.recovery_location_points(case_id, received_at desc);
create index if not exists recovery_location_points_client_received_idx
  on public.recovery_location_points(client_user_id, received_at desc);
create index if not exists recovery_location_points_device_received_idx
  on public.recovery_location_points(device_id, received_at desc);

alter table public.recovery_location_points enable row level security;
revoke all on table public.recovery_location_points from anon, authenticated;

comment on table public.recovery_location_points is
  'Consent-based live location fixes submitted by authenticated clients for their own recovery cases.';
