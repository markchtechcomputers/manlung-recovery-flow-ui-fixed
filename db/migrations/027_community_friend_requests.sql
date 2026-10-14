-- Manlung member-to-member friend requests.
-- Run this migration before enabling member chat in the client UI.
create table if not exists public.recovery_chat_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.recovery_users(id) on delete cascade,
  recipient_user_id uuid not null references public.recovery_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id)
);
create unique index if not exists recovery_chat_friend_requests_one_pending_pair
  on public.recovery_chat_friend_requests(sender_user_id, recipient_user_id)
  where status = 'pending';
create index if not exists recovery_chat_friend_requests_recipient_status_idx
  on public.recovery_chat_friend_requests(recipient_user_id, status, created_at desc);
create index if not exists recovery_chat_friend_requests_sender_status_idx
  on public.recovery_chat_friend_requests(sender_user_id, status, created_at desc);
alter table public.recovery_chat_friend_requests enable row level security;
revoke all on table public.recovery_chat_friend_requests from anon, authenticated;
notify pgrst, 'reload schema';
