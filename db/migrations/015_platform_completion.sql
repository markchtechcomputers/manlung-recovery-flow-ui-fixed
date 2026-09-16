-- Platform completion foundation: durable session invalidation + evidence audit.
-- Run in Supabase SQL Editor before deploying the matching application code.

alter table public.recovery_users
  add column if not exists session_version bigint not null default 0;

create index if not exists recovery_users_session_version_idx
  on public.recovery_users(id, session_version);

create table if not exists public.recovery_evidence_audit_log (
  id bigint generated always as identity primary key,
  case_id text not null,
  evidence_path text,
  action text not null check (action in ('upload','view','download','delete','signed_url')),
  actor_user_id uuid,
  actor_role text,
  filename text,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recovery_evidence_audit_case_idx
  on public.recovery_evidence_audit_log(case_id, created_at desc);

create index if not exists recovery_evidence_audit_actor_idx
  on public.recovery_evidence_audit_log(actor_user_id, created_at desc);

alter table public.recovery_evidence_audit_log enable row level security;

revoke all on table public.recovery_evidence_audit_log from anon, authenticated;

notify pgrst, 'reload schema';
