update public.recovery_chat_groups set is_default=false where slug<>'manlung-recovery-community' and is_default=true;
-- Ensure the platform-wide Manlung Community exists and contains all active client accounts.
insert into public.recovery_chat_groups (slug,name,description,is_default,avatar_url)
values ('manlung-recovery-community','Manlung Community','One shared group for all registered Manlung Recovery members.',true,'/icons/icon-512.png')
on conflict (slug) do update set name=excluded.name, description=excluded.description, is_default=true, avatar_url=excluded.avatar_url;

insert into public.recovery_chat_group_members (group_id,user_id,archived)
select g.id,u.id,false
from public.recovery_chat_groups g cross join public.recovery_users u
where g.slug='manlung-recovery-community' and u.role='client'
on conflict (group_id,user_id) do update set archived=false;
