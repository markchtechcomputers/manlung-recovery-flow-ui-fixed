-- Authenticated peer-to-peer WebRTC signaling for registered Manlung members.
create table if not exists public.recovery_peer_calls (
 id uuid primary key default gen_random_uuid(),
 caller_user_id uuid not null references public.recovery_users(id) on delete cascade,
 callee_user_id uuid not null references public.recovery_users(id) on delete cascade,
 call_mode text not null check(call_mode in ('audio','video')),
 status text not null default 'ringing' check(status in ('ringing','accepted','rejected','ended','missed')),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 ended_at timestamptz,
 check(caller_user_id<>callee_user_id)
);
create index if not exists recovery_peer_calls_caller_idx on public.recovery_peer_calls(caller_user_id,created_at desc);
create index if not exists recovery_peer_calls_callee_idx on public.recovery_peer_calls(callee_user_id,status,created_at desc);
create table if not exists public.recovery_peer_call_signals (
 id bigint generated always as identity primary key,
 call_id uuid not null references public.recovery_peer_calls(id) on delete cascade,
 sender_user_id uuid not null references public.recovery_users(id) on delete cascade,
 signal_type text not null check(signal_type in ('offer','answer','ice','accept','reject','hangup')),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check(pg_column_size(payload)<=32768)
);
create index if not exists recovery_peer_call_signals_call_idx on public.recovery_peer_call_signals(call_id,id);
alter table public.recovery_peer_calls enable row level security;
alter table public.recovery_peer_call_signals enable row level security;
revoke all on table public.recovery_peer_calls,public.recovery_peer_call_signals from anon,authenticated;
notify pgrst,'reload schema';
