-- ============================================================
-- Manlung Recovery
-- Secure Client <-> Investigator Case Messaging
-- ============================================================

create table if not exists case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  sender_user_id uuid not null,
  recipient_user_id uuid not null,
  message text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists case_messages_case_id_idx
  on case_messages(case_id);

create index if not exists case_messages_sender_idx
  on case_messages(sender_user_id);

create index if not exists case_messages_recipient_idx
  on case_messages(recipient_user_id);

create index if not exists case_messages_conversation_idx
  on case_messages(case_id, created_at);

alter table case_messages enable row level security;
