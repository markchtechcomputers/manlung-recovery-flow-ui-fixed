-- WhatsApp-style messaging state for Manlung Community.
-- Additive migration: preserves existing messages, preferences, reactions and memberships.
begin;

alter table public.recovery_community_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

alter table public.recovery_chat_preferences
  add column if not exists last_read_at timestamptz,
  add column if not exists marked_unread_at timestamptz,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists theme_key text not null default 'mint',
  add column if not exists theme_background_color text,
  add column if not exists theme_background_image_url text;

alter table public.recovery_chat_preferences
  drop constraint if exists recovery_chat_preferences_theme_key_check;
alter table public.recovery_chat_preferences
  add constraint recovery_chat_preferences_theme_key_check
  check (theme_key in ('mint','classic','ocean','lavender','rose','forest','custom'));

create index if not exists recovery_community_messages_recipient_unread_idx
  on public.recovery_community_messages(recipient_user_id, created_at desc)
  where read_at is null and deleted_at is null;

create index if not exists recovery_community_messages_conversation_time_idx
  on public.recovery_community_messages(sender_user_id, recipient_user_id, created_at desc);

-- A device session cursor prevents history/backlog from being replayed as new notifications
-- after reinstall, reconnect or browser restart. The client resets it at session start.
create table if not exists public.recovery_chat_notification_cursors (
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  device_id uuid not null,
  last_polled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, device_id)
);

-- Group receipt rows support the documented aggregate rule:
-- delivered = at least one other active member has received the message;
-- read = every other active member has read it.
create table if not exists public.recovery_chat_group_message_receipts (
  message_id uuid not null references public.recovery_chat_group_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key(message_id, user_id)
);

alter table public.recovery_chat_notification_cursors enable row level security;
alter table public.recovery_chat_group_message_receipts enable row level security;
revoke all on table public.recovery_chat_notification_cursors from anon, authenticated;
revoke all on table public.recovery_chat_group_message_receipts from anon, authenticated;

notify pgrst, 'reload schema';
commit;
