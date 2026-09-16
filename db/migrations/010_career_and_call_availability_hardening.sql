-- Manlung Recovery: safe career/call hardening.
-- Run after migration 009.
-- This migration does NOT replace the existing call/WebRTC/session mechanism.

create extension if not exists pgcrypto;

-- Career table is already created by 009. This is intentionally idempotent so
-- deployments that missed 009 can recover without creating a second table.
create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  location text not null,
  education text not null,
  experience text not null,
  role_interested text not null,
  skills text not null,
  cover_note text not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','shortlisted','hired','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists career_applications_created_at_idx
  on public.career_applications(created_at desc);
create index if not exists career_applications_status_idx
  on public.career_applications(status);

alter table public.career_applications enable row level security;

-- Protect the existing call flow at the database level. The application still
-- calls CallSession.accept() exactly as before; this trigger only prevents a
-- race where two admins/requests could accept two active calls for the same
-- admin at the same moment.
create or replace function public.enforce_one_active_call_per_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.admin_user_id is not null
     and NEW.status = 'accepted'
     and NEW.ended_at is null then

    -- Serialize acceptance attempts for this specific admin.
    perform pg_advisory_xact_lock(hashtext(NEW.admin_user_id::text));

    if exists (
      select 1
      from public.recovery_call_sessions existing
      where existing.admin_user_id = NEW.admin_user_id
        and existing.status = 'accepted'
        and existing.ended_at is null
        and existing.id <> NEW.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'ADMIN_ACTIVE_CALL_LIMIT';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists recovery_call_sessions_one_active_admin_call
  on public.recovery_call_sessions;

create trigger recovery_call_sessions_one_active_admin_call
before insert or update of admin_user_id, status, ended_at
on public.recovery_call_sessions
for each row
execute function public.enforce_one_active_call_per_admin();

notify pgrst, 'reload schema';
