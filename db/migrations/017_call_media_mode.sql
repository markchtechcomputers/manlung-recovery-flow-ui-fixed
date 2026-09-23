-- Per-call media mode. Audio is always supported; video is optional.
alter table public.recovery_call_sessions
  add column if not exists call_mode text not null default 'audio';

alter table public.recovery_call_sessions
  drop constraint if exists recovery_call_sessions_call_mode_check;

alter table public.recovery_call_sessions
  add constraint recovery_call_sessions_call_mode_check
  check (call_mode in ('audio','video'));

update public.recovery_call_sessions
set call_mode = 'audio'
where call_mode is null;

notify pgrst, 'reload schema';
