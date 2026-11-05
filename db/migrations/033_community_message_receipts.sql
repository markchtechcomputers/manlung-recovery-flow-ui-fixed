-- Add persistent delivery/read timestamps to Manlung direct messages.
-- The server API controls receipts; browser clients never write these columns directly.
begin;

alter table public.recovery_community_messages
  add column if not exists delivered_at timestamptz null,
  add column if not exists read_at timestamptz null;

create index if not exists recovery_community_messages_recipient_receipts_idx
  on public.recovery_community_messages(recipient_user_id, delivered_at, read_at)
  where deleted_at is null;

notify pgrst, 'reload schema';
commit;
