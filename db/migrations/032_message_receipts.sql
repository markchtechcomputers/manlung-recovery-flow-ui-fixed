-- Manlung Community: server-backed direct-message delivery and read receipts.
-- Safe to run more than once. Apply to the Manlung Recovery production Supabase project.
alter table public.recovery_community_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists recovery_community_messages_recipient_unread_idx
  on public.recovery_community_messages (recipient_user_id, sender_user_id, created_at desc)
  where read_at is null and deleted_at is null;

create index if not exists recovery_community_messages_recipient_delivery_idx
  on public.recovery_community_messages (recipient_user_id, created_at desc)
  where delivered_at is null and deleted_at is null;
