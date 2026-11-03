-- Require admin approval before a user-created community group is published.
-- Existing groups remain approved so no current community rooms disappear.
begin;

alter table public.recovery_chat_groups
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid references public.recovery_users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

-- New groups default to pending; existing rows were backfilled as approved
-- when the column was first added. This remains safe if the migration is rerun.
alter table public.recovery_chat_groups
  alter column approval_status set default 'pending';

update public.recovery_chat_groups
set approved_at=coalesce(approved_at,created_at)
where approval_status='approved';

alter table public.recovery_chat_groups
  drop constraint if exists recovery_chat_groups_approval_status_check;
alter table public.recovery_chat_groups
  add constraint recovery_chat_groups_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

create index if not exists recovery_chat_groups_approval_created_idx
  on public.recovery_chat_groups(approval_status,created_at desc);

notify pgrst,'reload schema';
commit;
