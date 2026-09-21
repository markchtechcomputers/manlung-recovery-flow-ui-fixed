-- Link Analysis selfie request tokens
create table if not exists public.recovery_selfie_requests (
  id uuid primary key default gen_random_uuid(),
  request_token_hash text not null unique,
  case_id text references public.recovery_cases(case_id) on delete cascade,
  reference text not null,
  request_type text not null default 'selfie',
  source text not null default 'link_analysis',
  status text not null default 'active' check (status in ('active','used','expired','revoked')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_by uuid references public.recovery_users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  captured_at timestamptz
);
create index if not exists recovery_selfie_requests_case_id_idx on public.recovery_selfie_requests(case_id);
create index if not exists recovery_selfie_requests_status_idx on public.recovery_selfie_requests(status, expires_at);
alter table public.recovery_selfie_requests enable row level security;
