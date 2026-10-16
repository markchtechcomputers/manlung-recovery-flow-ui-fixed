-- Manlung chat experience bundle: official read-only updates channel.
-- Run this in the Supabase SQL Editor for the SAME project used by the Vercel production app.
-- This is additive/idempotent; it does not replace existing chat, status, or payment tables.

create table if not exists public.recovery_chat_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Manlung Updates',
  body text not null,
  created_by uuid null references public.recovery_users(id) on delete set null,
  pinned boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_chat_announcements_title_len check (char_length(title) between 1 and 120),
  constraint recovery_chat_announcements_body_len check (char_length(body) between 1 and 10000)
);

create index if not exists recovery_chat_announcements_published_idx
  on public.recovery_chat_announcements (is_published, pinned desc, created_at desc);

alter table public.recovery_chat_announcements enable row level security;
revoke all on public.recovery_chat_announcements from anon, authenticated;
grant select, insert, update, delete on public.recovery_chat_announcements to service_role;

insert into public.recovery_chat_announcements (title, body, pinned, is_published)
select 'Welcome to Manlung Updates',
       'Welcome to Manlung Updates — the official news and announcements channel. You can open and read updates here, but replies and typing are disabled. Check back for important community news, feature updates, and notices.',
       true, true
where not exists (
  select 1 from public.recovery_chat_announcements
  where title = 'Welcome to Manlung Updates'
);

notify pgrst, 'reload schema';
