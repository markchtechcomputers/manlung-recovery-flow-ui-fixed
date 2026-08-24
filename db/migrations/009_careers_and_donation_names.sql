-- Careers portal and donor-name support.
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
create index if not exists career_applications_created_at_idx on public.career_applications(created_at desc);
create index if not exists career_applications_status_idx on public.career_applications(status);
alter table public.career_applications enable row level security;

do $$ begin
  if to_regclass('public.recovery_donations') is not null then
    alter table public.recovery_donations add column if not exists donor_name text;
  end if;
end $$;
