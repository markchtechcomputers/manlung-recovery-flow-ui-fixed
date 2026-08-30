-- Manlung Recovery: owner controls, audit actions and call/client hardening.
-- Run after 002_security_case_claims_admins.sql.

-- Ensure the admin status constraint supports the actual lifecycle used by the application.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'recovery_users'::regclass
      and conname = 'recovery_users_admin_status_check'
  ) then
    alter table recovery_users drop constraint recovery_users_admin_status_check;
  end if;
exception when undefined_table then
  null;
end $$;

do $$
begin
  if to_regclass('public.recovery_users') is not null then
    alter table recovery_users
      add constraint recovery_users_admin_status_check
      check (admin_status is null or admin_status in ('pending','active','suspended'));
  end if;
exception when duplicate_object then
  null;
end $$;

-- The audit log is used by Owner operations. Keep its action vocabulary explicit.
create table if not exists recovery_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references recovery_users(id) on delete set null,
  actor_username text,
  target_user_id uuid references recovery_users(id) on delete set null,
  target_username text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'recovery_admin_audit_log'::regclass
      and conname = 'recovery_admin_audit_log_action_check'
  ) then
    alter table recovery_admin_audit_log drop constraint recovery_admin_audit_log_action_check;
  end if;
exception when undefined_table then
  null;
end $$;

do $$
begin
  if to_regclass('public.recovery_admin_audit_log') is not null then
    alter table recovery_admin_audit_log
      add constraint recovery_admin_audit_log_action_check
      check (action in (
        'invited_admin',
        'assigned_admin',
        'approved_admin',
        'updated_admin_permissions',
        'suspended_admin',
        'reactivated_admin',
        'removed_admin',
        'cleared_call_logs',
        'deleted_client_message'
      ));
  end if;
exception when duplicate_object then
  null;
end $$;

create index if not exists recovery_admin_audit_log_created_at_idx
  on recovery_admin_audit_log(created_at desc);

-- Helpful indexes for owner/client/call lookup paths.
create index if not exists recovery_call_sessions_admin_status_idx
  on recovery_call_sessions(admin_user_id, status, accepted_at desc);

create index if not exists recovery_call_sessions_client_status_idx
  on recovery_call_sessions(client_user_id, status, created_at desc);
