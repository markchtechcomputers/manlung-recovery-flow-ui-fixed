-- Manlung Recovery community direct messages.
-- Run through the project's normal Supabase migration process before enabling messaging.
create table if not exists public.recovery_community_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.recovery_users(id) on delete cascade,
  recipient_user_id uuid not null references public.recovery_users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint community_message_not_self check (sender_user_id <> recipient_user_id)
);

create index if not exists recovery_community_messages_sender_created_idx
  on public.recovery_community_messages (sender_user_id, created_at desc);
create index if not exists recovery_community_messages_recipient_created_idx
  on public.recovery_community_messages (recipient_user_id, created_at desc);

alter table public.recovery_community_messages enable row level security;
revoke all on public.recovery_community_messages from anon, authenticated;
-- Server-side API uses the service-role client only after the app's JWT auth middleware.
