-- Donations + durable WebRTC signaling.
-- Run this migration in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.recovery_donations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  donor_email text not null,
  amount_kes integer not null check (amount_kes >= 50 and amount_kes <= 1000000),
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  paystack_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recovery_donations_status_idx
  on public.recovery_donations(status);

create table if not exists public.recovery_call_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.recovery_call_sessions(id) on delete cascade,
  sender_user_id uuid not null,
  event text not null check (event in ('offer','answer','ice-candidate','end')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recovery_call_signals_session_id_idx
  on public.recovery_call_signals(session_id, id);

-- Server uses the Supabase service_role key, so these tables do not need
-- browser write policies. Keep the browser away from the service key.
alter table public.recovery_donations enable row level security;
alter table public.recovery_call_signals enable row level security;

notify pgrst, 'reload schema';
