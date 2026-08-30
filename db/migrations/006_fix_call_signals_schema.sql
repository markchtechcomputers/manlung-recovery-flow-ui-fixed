-- Fix for: Could not find the table 'public.recovery_call_signals' in the schema cache.
-- Run this in the Supabase SQL Editor once. It is safe to run repeatedly.

create extension if not exists pgcrypto;

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

alter table public.recovery_call_signals enable row level security;

-- The Node API uses the Supabase service_role key. Do not expose that key to the browser.
-- Refresh PostgREST's schema cache so the new table is visible immediately.
notify pgrst, 'reload schema';
