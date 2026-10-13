-- Manlung Chat platform schema. Run once in Supabase SQL Editor.
-- All app access remains server-mediated; never expose the service-role key in browser code.
create extension if not exists pgcrypto;

create table if not exists public.recovery_chat_profiles (
 user_id uuid primary key references public.recovery_users(id) on delete cascade,
 display_name text,
 bio text not null default '' check(char_length(bio)<=500),
 avatar_url text,
 discoverable boolean not null default true,
 profile_visibility text not null default 'members' check(profile_visibility in ('members','nobody')),
 presence_visibility text not null default 'members' check(presence_visibility in ('everyone','members','nobody')),
 last_seen_visibility text not null default 'members' check(last_seen_visibility in ('everyone','members','nobody')),
 read_receipts_enabled boolean not null default true,
 status_visibility text not null default 'members' check(status_visibility in ('everyone','members','nobody')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.recovery_chat_presence (
 user_id uuid primary key references public.recovery_users(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists recovery_chat_presence_last_seen_idx on public.recovery_chat_presence(last_seen_at desc);

create table if not exists public.recovery_chat_preferences (
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 other_user_id uuid not null references public.recovery_users(id) on delete cascade,
 archived boolean not null default false,
 muted boolean not null default false,
 pinned boolean not null default false,
 starred boolean not null default false,
 cleared_before timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,other_user_id),
 check(user_id<>other_user_id)
);
create table if not exists public.recovery_chat_blocks (
 blocker_user_id uuid not null references public.recovery_users(id) on delete cascade,
 blocked_user_id uuid not null references public.recovery_users(id) on delete cascade,
 reason text check(reason is null or char_length(reason)<=500),
 created_at timestamptz not null default now(),
 primary key(blocker_user_id,blocked_user_id),
 check(blocker_user_id<>blocked_user_id)
);
create table if not exists public.recovery_chat_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_user_id uuid not null references public.recovery_users(id) on delete cascade,
 reported_user_id uuid references public.recovery_users(id) on delete set null,
 direct_message_id uuid references public.recovery_community_messages(id) on delete set null,
 group_id uuid,
 reason text not null check(char_length(reason) between 3 and 1000),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 reviewed_by uuid references public.recovery_users(id) on delete set null,
 reviewed_at timestamptz,
 resolution_note text,
 created_at timestamptz not null default now()
);
create index if not exists recovery_chat_reports_status_idx on public.recovery_chat_reports(status,created_at desc);

create table if not exists public.recovery_chat_groups (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 name text not null check(char_length(name) between 1 and 100),
 description text not null default '' check(char_length(description)<=2000),
 avatar_url text,
 is_default boolean not null default false,
 created_by uuid references public.recovery_users(id) on delete set null,
 allow_member_invites boolean not null default true,
 admin_only_announcements boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index if not exists recovery_chat_groups_one_default_idx on public.recovery_chat_groups(is_default) where is_default;
create table if not exists public.recovery_chat_group_members (
 group_id uuid not null references public.recovery_chat_groups(id) on delete cascade,
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 muted boolean not null default false,
 archived boolean not null default true,
 unarchive_on_mention boolean not null default true,
 primary key(group_id,user_id)
);
create index if not exists recovery_chat_group_members_user_idx on public.recovery_chat_group_members(user_id,joined_at desc);
create table if not exists public.recovery_chat_group_messages (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.recovery_chat_groups(id) on delete cascade,
 sender_user_id uuid not null references public.recovery_users(id) on delete cascade,
 message text not null check(char_length(message) between 1 and 5000),
 reply_to_id uuid references public.recovery_chat_group_messages(id) on delete set null,
 edited_at timestamptz,
 deleted_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists recovery_chat_group_messages_group_created_idx on public.recovery_chat_group_messages(group_id,created_at desc);
create table if not exists public.recovery_chat_group_reactions (
 message_id uuid not null references public.recovery_chat_group_messages(id) on delete cascade,
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 reaction text not null check(char_length(reaction) between 1 and 16),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,reaction)
);

alter table public.recovery_community_messages
 add column if not exists edited_at timestamptz,
 add column if not exists deleted_at timestamptz,
 add column if not exists reply_to_id uuid references public.recovery_community_messages(id) on delete set null;
create table if not exists public.recovery_chat_message_receipts (
 message_id uuid not null references public.recovery_community_messages(id) on delete cascade,
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 delivered_at timestamptz,
 read_at timestamptz,
 primary key(message_id,user_id)
);
create table if not exists public.recovery_chat_message_reactions (
 message_id uuid not null references public.recovery_community_messages(id) on delete cascade,
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 reaction text not null check(char_length(reaction) between 1 and 16),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,reaction)
);
create table if not exists public.recovery_chat_attachments (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.recovery_users(id) on delete cascade,
 direct_message_id uuid references public.recovery_community_messages(id) on delete cascade,
 group_message_id uuid references public.recovery_chat_group_messages(id) on delete cascade,
 storage_path text not null unique,
 original_name text not null check(char_length(original_name) between 1 and 255),
 mime_type text not null check(char_length(mime_type)<=150),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800),
 created_at timestamptz not null default now(),
 check((direct_message_id is not null and group_message_id is null) or (direct_message_id is null and group_message_id is not null))
);

create table if not exists public.recovery_chat_status_wallets (
 user_id uuid primary key references public.recovery_users(id) on delete cascade,
 free_status_last_used_at timestamptz,
 paid_status_credits integer not null default 0 check(paid_status_credits>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.recovery_chat_status_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 status_type text not null default 'text' check(status_type in ('text','image','video')),
 text_content text not null default '' check(char_length(text_content)<=2000),
 media_path text,
 caption text not null default '' check(char_length(caption)<=1000),
 expires_at timestamptz not null default(now()+interval '24 hours'),
 created_at timestamptz not null default now(),
 check(char_length(trim(text_content))>0 or media_path is not null)
);
create index if not exists recovery_chat_status_expiry_idx on public.recovery_chat_status_posts(expires_at desc);
create index if not exists recovery_chat_status_user_created_idx on public.recovery_chat_status_posts(user_id,created_at desc);
create table if not exists public.recovery_chat_status_views (
 status_id uuid not null references public.recovery_chat_status_posts(id) on delete cascade,
 viewer_user_id uuid not null references public.recovery_users(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(status_id,viewer_user_id)
);
create table if not exists public.recovery_chat_status_purchases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 provider text not null default 'paystack' check(provider='paystack'),
 provider_reference text not null unique,
 provider_transaction_id text unique,
 amount_kes integer not null default 100 check(amount_kes=100),
 currency text not null default 'KES' check(currency='KES'),
 credits integer not null default 2 check(credits=2),
 status text not null default 'pending' check(status in ('pending','paid','failed','cancelled','reversed')),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists recovery_chat_status_purchase_user_idx on public.recovery_chat_status_purchases(user_id,created_at desc);

create table if not exists public.recovery_chat_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 plan_code text not null check(plan_code in ('free','premium')),
 status text not null default 'active' check(status in ('pending','active','cancelled','expired','failed')),
 starts_at timestamptz,
 expires_at timestamptz,
 provider_reference text unique,
 amount_kes integer not null default 0 check(amount_kes>=0),
 currency text not null default 'KES' check(currency='KES'),
 auto_renew boolean not null default false,
 cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists recovery_chat_subscriptions_user_idx on public.recovery_chat_subscriptions(user_id,expires_at desc);

-- No browser role can directly read/write platform tables. Server API uses service_role.
do $$
declare t text;
begin
 foreach t in array array[
 'recovery_chat_profiles','recovery_chat_presence','recovery_chat_preferences','recovery_chat_blocks',
 'recovery_chat_reports','recovery_chat_groups','recovery_chat_group_members','recovery_chat_group_messages',
 'recovery_chat_group_reactions','recovery_chat_message_receipts','recovery_chat_message_reactions',
 'recovery_chat_attachments','recovery_chat_status_wallets','recovery_chat_status_posts',
 'recovery_chat_status_views','recovery_chat_status_purchases','recovery_chat_subscriptions'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
 end loop;
end $$;

insert into public.recovery_chat_groups(slug,name,description,is_default,allow_member_invites)
values('manlung-community','Manlung Community','The official community for Manlung members.',true,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,is_default=true;

insert into public.recovery_chat_profiles(user_id,display_name)
select id,coalesce(nullif(trim(username),''),'Member') from public.recovery_users
where role in ('client','admin','owner') on conflict(user_id) do nothing;
insert into public.recovery_chat_status_wallets(user_id)
select id from public.recovery_users where role in ('client','admin','owner') on conflict(user_id) do nothing;
insert into public.recovery_chat_group_members(group_id,user_id,archived)
select g.id,u.id,true from public.recovery_chat_groups g cross join public.recovery_users u
where g.slug='manlung-community' and u.role in ('client','admin','owner')
on conflict(group_id,user_id) do nothing;

notify pgrst,'reload schema';
