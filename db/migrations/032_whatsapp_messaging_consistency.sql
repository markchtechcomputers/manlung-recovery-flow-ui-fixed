-- WhatsApp-style messaging consistency for Manlung Community.
-- Additive migration: preserves existing conversations, messages, receipts and preferences.
begin;

-- Persist direct delivery/read timestamps on the message row so read state is monotonic.
alter table public.recovery_community_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

-- Backfill the existing receipt table before the API starts reading message-row state.
update public.recovery_community_messages m
set delivered_at = coalesce(m.delivered_at, r.delivered_at),
    read_at = coalesce(m.read_at, r.read_at)
from public.recovery_chat_message_receipts r
where r.message_id = m.id
  and r.user_id = m.recipient_user_id
  and (m.delivered_at is null or m.read_at is null);

-- Keep the previous cleared-before boundary as the initial read cursor.
alter table public.recovery_chat_preferences
  add column if not exists last_read_at timestamptz,
  add column if not exists marked_unread_at timestamptz,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists theme_key text not null default 'mint',
  add column if not exists theme_background_color text,
  add column if not exists theme_background_image_url text;

update public.recovery_chat_preferences
set last_read_at = cleared_before
where last_read_at is null and cleared_before is not null;

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

-- One reaction per user/message. Keep the most recent existing reaction if legacy data has multiples.
with ranked as (
  select ctid, row_number() over (
    partition by message_id, user_id order by created_at desc, ctid desc
  ) as rn
  from public.recovery_chat_message_reactions
)
delete from public.recovery_chat_message_reactions r
using ranked x
where r.ctid = x.ctid and x.rn > 1;

with ranked as (
  select ctid, row_number() over (
    partition by message_id, user_id order by created_at desc, ctid desc
  ) as rn
  from public.recovery_chat_group_reactions
)
delete from public.recovery_chat_group_reactions r
using ranked x
where r.ctid = x.ctid and x.rn > 1;

create unique index if not exists recovery_chat_message_reactions_one_per_user_idx
  on public.recovery_chat_message_reactions(message_id, user_id);
create unique index if not exists recovery_chat_group_reactions_one_per_user_idx
  on public.recovery_chat_group_reactions(message_id, user_id);

-- A per-device notification cursor is separate from the per-chat unread/read cursor.
-- Resetting a device session suppresses history replay without changing unread counts.
create table if not exists public.recovery_chat_notification_cursors (
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  device_id uuid not null,
  last_polled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
create index if not exists recovery_chat_notification_cursors_user_idx
  on public.recovery_chat_notification_cursors(user_id, updated_at desc);

-- Per-recipient group receipts. Aggregate rule is documented in the app's messaging notes.
create table if not exists public.recovery_chat_group_message_receipts (
  message_id uuid not null references public.recovery_chat_group_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index if not exists recovery_chat_group_message_receipts_user_idx
  on public.recovery_chat_group_message_receipts(user_id, message_id);

alter table public.recovery_chat_group_members
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_read_at timestamptz,
  add column if not exists marked_unread_at timestamptz,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists theme_key text not null default 'mint',
  add column if not exists theme_background_color text,
  add column if not exists theme_background_image_url text;

-- Older group memberships had no persisted read cursor; baseline them at
-- migration time so historical group messages do not become unread backlog.
update public.recovery_chat_group_members
set last_read_at = now(), updated_at = now()
where last_read_at is null;

alter table public.recovery_chat_group_members
  drop constraint if exists recovery_chat_group_members_theme_key_check;
alter table public.recovery_chat_group_members
  add constraint recovery_chat_group_members_theme_key_check
  check (theme_key in ('mint','classic','ocean','lavender','rose','forest','custom'));

alter table public.recovery_chat_notification_cursors enable row level security;
alter table public.recovery_chat_group_message_receipts enable row level security;
revoke all on table public.recovery_chat_notification_cursors from anon, authenticated;
revoke all on table public.recovery_chat_group_message_receipts from anon, authenticated;

notify pgrst, 'reload schema';
commit;
