-- Direct-chat state used by the Manlung Recovery client.
-- Run in the same Supabase project as the existing community migrations.
begin;

-- The API already exposes these fields to the client. Keep them on the message row
-- so delivery/read state is durable and survives reconnects and app restarts.
alter table public.recovery_community_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists recovery_community_messages_receipts_idx
  on public.recovery_community_messages(recipient_user_id, sender_user_id, read_at, created_at desc);

-- Server-side storage for future account sync of chat preferences. The current
-- client persists these locally and safely falls back when this table is absent.
alter table public.recovery_chat_preferences
  add column if not exists chat_theme text,
  add column if not exists chat_background text,
  add column if not exists manual_unread_at timestamptz;

alter table public.recovery_chat_preferences
  drop constraint if exists recovery_chat_preferences_chat_theme_check;
alter table public.recovery_chat_preferences
  add constraint recovery_chat_preferences_chat_theme_check
  check (chat_theme is null or chat_theme in ('mint','classic','ocean','lavender','rose','forest'));

notify pgrst, 'reload schema';
commit;
