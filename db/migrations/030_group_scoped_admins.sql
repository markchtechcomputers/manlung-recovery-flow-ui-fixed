-- Add group-scoped roles without granting main-app privileges.
-- Apply this migration in Supabase before using group admin controls.
alter table public.recovery_chat_group_members
  add column if not exists member_role text not null default 'member';

alter table public.recovery_chat_group_members
  drop constraint if exists recovery_chat_group_members_member_role_check;
alter table public.recovery_chat_group_members
  add constraint recovery_chat_group_members_member_role_check
  check (member_role in ('member','admin'));

-- Existing Manlung main-app admins/owners are group admins in groups they belong to.
update public.recovery_chat_group_members gm
set member_role = 'admin'
from public.recovery_users u
where u.id = gm.user_id and u.role in ('admin','owner');
