-- Add delivery receipts to existing Manlung Recovery case chats.
-- A message is delivered when the recipient loads the case conversation;
-- read_at is set separately after the conversation displays the message.
begin;

alter table public.case_messages
  add column if not exists delivered_at timestamptz null;

create index if not exists case_messages_recipient_unread_idx
  on public.case_messages(recipient_user_id, delivered_at, read_at);

notify pgrst, 'reload schema';
commit;
