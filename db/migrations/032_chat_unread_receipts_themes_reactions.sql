-- Manlung messaging reliability: unread cursors, delivery/read receipts, per-chat themes and single-reaction state.
-- Apply to the main Manlung Supabase project before deploying the matching API.
begin;

alter table public.recovery_chat_preferences
  add column if not exists manual_unread boolean not null default false,
  add column if not exists manual_unread_at timestamptz,
  add column if not exists last_read_at timestamptz not null default now(),
  add column if not exists chat_theme_id text not null default 'mint',
  add column if not exists background_color text,
  add column if not exists background_image_url text;

alter table public.recovery_chat_preferences
  drop constraint if exists recovery_chat_preferences_theme_id_check;
alter table public.recovery_chat_preferences
  add constraint recovery_chat_preferences_theme_id_check
  check (chat_theme_id in ('mint','classic','ocean','lavender','rose','forest','custom'));

-- Direct message receipts already exist in migration 020. Keep delivery/read state
-- per recipient, rather than duplicating receipt columns on message content rows.
create table if not exists public.recovery_chat_message_receipts (
  message_id uuid not null references public.recovery_community_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index if not exists recovery_chat_message_receipts_user_read_idx
  on public.recovery_chat_message_receipts(user_id, read_at, delivered_at);

-- Keep legacy reaction rows intact. Copy each member's most recent reaction
-- into v2 tables with one row per member/message; this avoids destructive cleanup.
create table if not exists public.recovery_chat_message_reactions_v2 (
  message_id uuid not null references public.recovery_community_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
insert into public.recovery_chat_message_reactions_v2 (message_id,user_id,reaction,created_at)
select distinct on (message_id,user_id) message_id,user_id,reaction,created_at
from public.recovery_chat_message_reactions
order by message_id,user_id,created_at desc,reaction desc
on conflict (message_id,user_id) do nothing;

create table if not exists public.recovery_chat_group_reactions_v2 (
  message_id uuid not null references public.recovery_chat_group_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
insert into public.recovery_chat_group_reactions_v2 (message_id,user_id,reaction,created_at)
select distinct on (message_id,user_id) message_id,user_id,reaction,created_at
from public.recovery_chat_group_reactions
order by message_id,user_id,created_at desc,reaction desc
on conflict (message_id,user_id) do nothing;

-- Per-member group chat preferences and read cursor.
alter table public.recovery_chat_group_members
  add column if not exists manual_unread boolean not null default false,
  add column if not exists manual_unread_at timestamptz,
  add column if not exists last_read_at timestamptz not null default now(),
  add column if not exists chat_theme_id text not null default 'mint',
  add column if not exists background_color text,
  add column if not exists background_image_url text;

alter table public.recovery_chat_group_members
  drop constraint if exists recovery_chat_group_members_theme_id_check;

-- Existing conversations have no reliable historical per-message read receipt.
-- Establish a migration-time baseline so syncing legacy history never marks it new.
insert into public.recovery_chat_preferences (user_id, other_user_id, last_read_at)
select distinct sender_user_id, recipient_user_id, now()
from public.recovery_community_messages
where sender_user_id is not null and recipient_user_id is not null
union
select distinct recipient_user_id, sender_user_id, now()
from public.recovery_community_messages
where sender_user_id is not null and recipient_user_id is not null
on conflict (user_id, other_user_id) do nothing;

update public.recovery_chat_preferences set last_read_at = now() where last_read_at is null;
update public.recovery_chat_group_members set last_read_at = now() where last_read_at is null;
alter table public.recovery_chat_group_members
  add constraint recovery_chat_group_members_theme_id_check
  check (chat_theme_id in ('mint','classic','ocean','lavender','rose','forest','custom'));

-- Group aggregate receipts are computed against current group members other
-- than the sender: all delivered => double gray; all read => double blue.
create table if not exists public.recovery_chat_group_message_receipts (
  message_id uuid not null references public.recovery_chat_group_messages(id) on delete cascade,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index if not exists recovery_chat_group_message_receipts_user_read_idx
  on public.recovery_chat_group_message_receipts(user_id, read_at, delivered_at);

alter table public.recovery_chat_message_receipts enable row level security;
alter table public.recovery_chat_group_message_receipts enable row level security;
alter table public.recovery_chat_message_reactions_v2 enable row level security;
alter table public.recovery_chat_group_reactions_v2 enable row level security;
revoke all on table public.recovery_chat_message_receipts from anon, authenticated;
revoke all on table public.recovery_chat_group_message_receipts from anon, authenticated;
revoke all on table public.recovery_chat_message_reactions_v2 from anon, authenticated;
revoke all on table public.recovery_chat_group_reactions_v2 from anon, authenticated;

notify pgrst, 'reload schema';
commit;
