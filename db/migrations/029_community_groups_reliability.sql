-- Community/groups reliability patch. Requires the Manlung app's public.recovery_users table.
-- Run only in the Supabase project used by the Manlung Recovery backend.
begin;

alter table public.recovery_chat_profiles
  add column if not exists avatar_visibility text not null default 'public';

alter table public.recovery_chat_profiles
  drop constraint if exists recovery_chat_profiles_avatar_visibility_check;
alter table public.recovery_chat_profiles
  add constraint recovery_chat_profiles_avatar_visibility_check
  check (avatar_visibility in ('public','private'));

alter table public.recovery_chat_profiles
  drop constraint if exists recovery_chat_profiles_profile_visibility_check;
alter table public.recovery_chat_profiles
  add constraint recovery_chat_profiles_profile_visibility_check
  check (profile_visibility in ('everyone','members','nobody'));

-- Ensure existing registered accounts have a profile and status wallet.
insert into public.recovery_chat_profiles(user_id, display_name, avatar_visibility)
select id, coalesce(nullif(trim(username),''),'Member'), 'public'
from public.recovery_users
where role in ('client','admin','owner')
on conflict (user_id) do nothing;

insert into public.recovery_chat_status_wallets(user_id)
select id from public.recovery_users where role in ('client','admin','owner')
on conflict (user_id) do nothing;

-- Create/update official rooms idempotently.
insert into public.recovery_chat_groups(slug,name,description,avatar_url,is_default,allow_member_invites,admin_only_announcements)
values
 ('manlung-team','Manlung Team','The official Manlung team room for registered members. Be respectful and build each other up.','https://manlungrecovery.manlungshop.co.ke/icons/icon-512.png',false,true,false),
 ('manlung-updates','Manlung Updates','Official Manlung news and website updates. Members can read and react; only admins and the owner can post.','https://manlungrecovery.manlungshop.co.ke/icons/icon-512.png',false,false,true)
on conflict (slug) do update set
 name=excluded.name, description=excluded.description, avatar_url=excluded.avatar_url,
 allow_member_invites=excluded.allow_member_invites,
 admin_only_announcements=excluded.admin_only_announcements;

-- Keep every registered account in the Updates channel; staff also get the team room.
insert into public.recovery_chat_group_members(group_id,user_id,archived)
select g.id,u.id,false
from public.recovery_chat_groups g
cross join public.recovery_users u
where g.slug='manlung-updates' and u.role in ('client','admin','owner')
on conflict (group_id,user_id) do nothing;

insert into public.recovery_chat_group_members(group_id,user_id,archived)
select g.id,u.id,false
from public.recovery_chat_groups g
cross join public.recovery_users u
where g.slug='manlung-team' and u.role in ('admin','owner')
on conflict (group_id,user_id) do nothing;

-- Future account creation/role changes keep official group access in sync.
create or replace function public.recovery_chat_sync_official_groups()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare team_id uuid; updates_id uuid;
begin
 select id into team_id from public.recovery_chat_groups where slug='manlung-team' limit 1;
 select id into updates_id from public.recovery_chat_groups where slug='manlung-updates' limit 1;

 if new.role in ('client','admin','owner') then
   insert into public.recovery_chat_profiles(user_id,display_name,avatar_visibility)
   values(new.id,coalesce(nullif(trim(new.username),''),'Member'),'public')
   on conflict(user_id) do nothing;
   insert into public.recovery_chat_status_wallets(user_id)
   values(new.id) on conflict(user_id) do nothing;
   if updates_id is not null then
     insert into public.recovery_chat_group_members(group_id,user_id,archived)
     values(updates_id,new.id,false) on conflict(group_id,user_id) do nothing;
   end if;
 else
   if updates_id is not null then delete from public.recovery_chat_group_members where group_id=updates_id and user_id=new.id; end if;
 end if;

 if team_id is not null and new.role in ('admin','owner') then
   insert into public.recovery_chat_group_members(group_id,user_id,archived)
   values(team_id,new.id,false) on conflict(group_id,user_id) do nothing;
 elsif team_id is not null then
   delete from public.recovery_chat_group_members where group_id=team_id and user_id=new.id;
 end if;
 return new;
end;
$$;

drop trigger if exists recovery_chat_sync_official_groups_trigger on public.recovery_users;
create trigger recovery_chat_sync_official_groups_trigger
after insert or update of role on public.recovery_users
for each row execute function public.recovery_chat_sync_official_groups();

revoke all on function public.recovery_chat_sync_official_groups() from public,anon,authenticated;

alter table public.recovery_chat_group_reactions enable row level security;
revoke all on table public.recovery_chat_group_reactions from anon,authenticated;

notify pgrst,'reload schema';
commit;
