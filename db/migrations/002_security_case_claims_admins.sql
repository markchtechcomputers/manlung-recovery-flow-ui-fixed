-- Manlung Recovery: security, case claiming, admin onboarding and permissions
-- Run in Supabase SQL editor after the existing schema.

alter table recovery_cases add column if not exists client_user_id uuid references recovery_users(id) on delete set null;
alter table recovery_cases add column if not exists assigned_admin_id uuid references recovery_users(id) on delete set null;
alter table recovery_cases add column if not exists assigned_at timestamptz;
alter table recovery_cases add column if not exists started_at timestamptz;
alter table recovery_cases add column if not exists completed_at timestamptz;
alter table recovery_cases add column if not exists completed_by uuid references recovery_users(id) on delete set null;

update recovery_cases c
set client_user_id = u.id
from recovery_users u
where c.client_user_id is null and lower(c.email) = lower(u.email) and u.role = 'client';

create index if not exists recovery_cases_client_user_id_idx on recovery_cases(client_user_id);
create index if not exists recovery_cases_assigned_admin_id_idx on recovery_cases(assigned_admin_id);

create table if not exists admin_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references recovery_users(id) on delete cascade,
  permission text not null,
  granted_by uuid references recovery_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, permission)
);

create table if not exists admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid not null references recovery_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists admin_invitations_email_idx on admin_invitations(lower(email));

-- Atomic claim: only one active case per admin and only one admin can win a case.
create or replace function claim_recovery_case(p_case_id text, p_admin_id uuid)
returns recovery_cases
language plpgsql
security definer
set search_path = public
as $$
declare result recovery_cases;
begin
  if exists (
    select 1 from recovery_cases
    where assigned_admin_id = p_admin_id
      and status not in ('Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected')
  ) then
    raise exception 'ADMIN_ALREADY_HAS_ACTIVE_CASE';
  end if;

  update recovery_cases
  set assigned_admin_id = p_admin_id,
      assigned_at = coalesce(assigned_at, now()),
      started_at = coalesce(started_at, now()),
      status = case when status = 'Pending Review' then 'Accepted' else status end,
      last_updated = now()::text
  where case_id = p_case_id
    and assigned_admin_id is null
    and status not in ('Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected')
  returning * into result;

  if result.id is null then
    raise exception 'CASE_ALREADY_CLAIMED_OR_UNAVAILABLE';
  end if;
  return result;
end;
$$;

create or replace function complete_recovery_case(p_case_id text, p_admin_id uuid, p_status text)
returns recovery_cases
language plpgsql
security definer
set search_path = public
as $$
declare result recovery_cases;
begin
  update recovery_cases
  set status = p_status,
      completed_at = now(),
      completed_by = p_admin_id,
      last_updated = now()::text
  where case_id = p_case_id
    and assigned_admin_id = p_admin_id
    and p_status in ('Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected')
  returning * into result;
  if result.id is null then raise exception 'CASE_NOT_ASSIGNED_TO_ADMIN'; end if;
  return result;
end;
$$;

-- Existing admins receive the safe operational permissions; Owner remains unrestricted.
insert into admin_permissions (user_id, permission)
select u.id, p.permission
from recovery_users u
cross join (values
 ('HANDLE_CASES'),('UPDATE_CASES'),('VIEW_CLIENT_CONTACT'),('ANSWER_CALLS'),('UPLOAD_EVIDENCE'),('VIEW_CASE_HISTORY')
) p(permission)
where u.role = 'admin'
on conflict (user_id, permission) do nothing;
