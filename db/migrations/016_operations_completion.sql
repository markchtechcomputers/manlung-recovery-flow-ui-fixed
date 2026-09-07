-- Operations completion schema. Idempotent; run in Supabase SQL Editor before deploying.

create extension if not exists pgcrypto;

-- Case lifecycle / SLA fields.
alter table public.recovery_cases add column if not exists priority text not null default 'normal';
alter table public.recovery_cases add column if not exists sla_due_at timestamptz;
alter table public.recovery_cases add column if not exists closed_at timestamptz;
alter table public.recovery_cases add column if not exists reopened_at timestamptz;
alter table public.recovery_cases add column if not exists last_status_changed_at timestamptz;
alter table public.recovery_cases add column if not exists assigned_by_user_id uuid;
alter table public.recovery_cases add column if not exists assignment_reason text;
create index if not exists recovery_cases_queue_idx on public.recovery_cases(priority, sla_due_at, created_at desc);
create index if not exists recovery_cases_assignee_status_idx on public.recovery_cases(assigned_admin_id, status, created_at desc);

-- Durable security event history. Do not store passwords, OTPs, tokens or secrets.
create table if not exists public.recovery_security_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','low','medium','high','critical')),
  user_id uuid references public.recovery_users(id) on delete set null,
  login_identifier text,
  ip_hash text,
  user_agent_hash text,
  path text,
  http_status integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists recovery_security_events_user_idx on public.recovery_security_events(user_id, created_at desc);
create index if not exists recovery_security_events_type_idx on public.recovery_security_events(event_type, created_at desc);
create index if not exists recovery_security_events_ip_idx on public.recovery_security_events(ip_hash, created_at desc);
alter table public.recovery_security_events enable row level security;
revoke all on table public.recovery_security_events from anon, authenticated;

-- Missed/reconnect/network diagnostics for calls.
alter table public.recovery_call_sessions add column if not exists network_quality text;
alter table public.recovery_call_sessions add column if not exists reconnect_count integer not null default 0;
alter table public.recovery_call_sessions add column if not exists last_network_event text;
alter table public.recovery_call_sessions add column if not exists missed_notified_at timestamptz;
create index if not exists recovery_call_sessions_missed_idx on public.recovery_call_sessions(status, ringing_started_at desc);

-- Rich evidence metadata. Existing audit rows remain valid.
alter table public.recovery_evidence_audit_log add column if not exists mime_type text;
alter table public.recovery_evidence_audit_log add column if not exists size_bytes bigint;
alter table public.recovery_evidence_audit_log add column if not exists category text;
alter table public.recovery_evidence_audit_log add column if not exists uploader_user_id uuid;
create index if not exists recovery_evidence_audit_hash_idx on public.recovery_evidence_audit_log(sha256);

-- Message delivery/read lifecycle.
alter table public.case_messages add column if not exists delivered_at timestamptz;
alter table public.case_messages add column if not exists edited_at timestamptz;
create index if not exists case_messages_read_idx on public.case_messages(recipient_user_id, read_at, created_at desc);

-- Donation idempotency/receipt metadata.
alter table public.recovery_donations add column if not exists receipt_number text;
alter table public.recovery_donations add column if not exists confirmed_at timestamptz;
alter table public.recovery_donations add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists recovery_donations_paystack_tx_unique on public.recovery_donations(paystack_transaction_id) where paystack_transaction_id is not null;
create index if not exists recovery_donations_email_idx on public.recovery_donations(donor_email, created_at desc);

notify pgrst, 'reload schema';
