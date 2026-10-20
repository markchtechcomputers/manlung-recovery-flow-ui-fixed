-- Manlung Recovery community media prerequisites.
-- Run in the SAME Supabase project configured in the Vercel backend.
-- The server creates short-lived signed URLs; these buckets stay private.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recovery-chat-media', 'recovery-chat-media', false, 12582912,
   array['audio/webm','audio/mp4','audio/aac','audio/ogg','audio/mpeg','audio/wav','audio/x-wav']),
  ('recovery-status-media', 'recovery-status-media', false, 20971520,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Server-mediated API only. Do not grant browser roles direct access.
revoke all on table storage.objects from anon, authenticated;

-- These columns are used by the message history/edit/unsend routes.
alter table public.recovery_community_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to_id uuid references public.recovery_community_messages(id) on delete set null;

create index if not exists recovery_community_messages_conversation_idx
  on public.recovery_community_messages(sender_user_id, recipient_user_id, created_at desc);
create index if not exists recovery_community_messages_not_deleted_idx
  on public.recovery_community_messages(created_at desc)
  where deleted_at is null;

-- Persistent per-user direct-chat settings for pin/archive/mute/star.
create table if not exists public.recovery_chat_preferences (
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  other_user_id uuid not null references public.recovery_users(id) on delete cascade,
  archived boolean not null default false,
  muted boolean not null default false,
  pinned boolean not null default false,
  starred boolean not null default false,
  cleared_before timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, other_user_id),
  check (user_id <> other_user_id)
);
alter table public.recovery_chat_preferences enable row level security;
revoke all on table public.recovery_chat_preferences from anon, authenticated;

notify pgrst, 'reload schema';
commit;
