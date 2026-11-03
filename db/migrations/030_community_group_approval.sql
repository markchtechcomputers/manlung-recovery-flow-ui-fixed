-- Require admin approval before a user-created community group is published.
-- Existing groups remain approved so no current community rooms disappear.
begin;

alter table public.recovery_chat_groups
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid references public.recovery_users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

update public.recovery_chat_groups
set approval_status='approved',
    approved_at=coalesce(approved_at,created_at)
where approval_status='pending';

alter table public.recovery_chat_groups
  drop constraint if exists recovery_chat_groups_approval_status_check;
alter table public.recovery_chat_groups
  add constraint recovery_chat_groups_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

create index if not exists recovery_chat_groups_approval_created_idx
  on public.recovery_chat_groups(approval_status,created_at desc);

notify pgrst,'reload schema';
commit;
