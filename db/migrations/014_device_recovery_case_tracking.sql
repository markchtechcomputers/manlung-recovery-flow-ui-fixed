-- Manlung Recovery: persistent Lost Device Recovery case tracking.
-- The server remains the only writer for recovery data; the new location table
-- is protected by RLS and is never populated with inferred coordinates.

alter table public.recovery_cases
  add column if not exists recovery_platform text,
  add column if not exists ownership_verified_at timestamptz,
  add column if not exists ownership_verified_by uuid references public.recovery_users(id) on delete set null,
  add column if not exists device_recovery_source text,
  add column if not exists recovery_last_reported_at timestamptz;

create table if not exists public.recovery_device_locations (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references public.recovery_cases(case_id) on delete cascade,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_meters numeric(10,2),
  source text not null,
  reported_at timestamptz not null default now(),
  recorded_by uuid references public.recovery_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recovery_device_locations_case_idx
  on public.recovery_device_locations(case_id, reported_at desc);

alter table public.recovery_device_locations enable row level security;

notify pgrst, 'reload schema';
