-- Client case satisfaction feedback. Server-mediated writes only.
create table if not exists public.recovery_case_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  user_id uuid not null references public.recovery_users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  feedback text not null default '' check (char_length(feedback) <= 1000),
  created_at timestamptz not null default now(),
  unique(case_id,user_id)
);
create index if not exists recovery_case_feedback_created_idx
  on public.recovery_case_feedback(created_at desc);
alter table public.recovery_case_feedback enable row level security;
revoke all on table public.recovery_case_feedback from anon, authenticated;
notify pgrst,'reload schema';
