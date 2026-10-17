-- Manlung Recovery login hardening.
-- Apply this migration to Supabase before deploying the matching backend code.

alter table public.recovery_users
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists login_locked_until timestamptz,
  add column if not exists last_login_at timestamptz;

alter table public.recovery_users
  drop constraint if exists recovery_users_failed_login_attempts_check;
alter table public.recovery_users
  add constraint recovery_users_failed_login_attempts_check
  check (failed_login_attempts between 0 and 3);
create index if not exists recovery_users_login_locked_until_idx
  on public.recovery_users (login_locked_until)
  where login_locked_until is not null;

-- Serialize failed-login increments in PostgreSQL so parallel requests cannot
-- bypass the per-account threshold.
create or replace function public.record_recovery_login_failure(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_failures integer;
  current_lock timestamptz;
  next_failures integer;
  next_lock timestamptz;
begin
  select coalesce(failed_login_attempts, 0), login_locked_until
    into current_failures, current_lock
    from public.recovery_users
   where id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('locked', false, 'failed_attempts', 0, 'locked_until', null);
  end if;

  if current_lock is not null and current_lock > now() then
    return jsonb_build_object('locked', true, 'failed_attempts', current_failures, 'locked_until', current_lock);
  end if;

  if current_lock is not null and current_lock <= now() then
    current_failures := 0;
  end if;

  next_failures := least(current_failures + 1, 3);
  next_lock := case when next_failures >= 3 then now() + interval '7 days' else null end;

  update public.recovery_users
     set failed_login_attempts = next_failures,
         login_locked_until = next_lock
   where id = p_user_id;

  return jsonb_build_object(
    'locked', next_failures >= 3,
    'failed_attempts', next_failures,
    'locked_until', next_lock
  );
end;
$$;

-- Shared fixed-window limiter used across Vercel serverless instances.
create table if not exists public.recovery_auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.recovery_auth_rate_limits enable row level security;
revoke all on table public.recovery_auth_rate_limits from anon, authenticated;

create or replace function public.allow_recovery_login_rate(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  next_count integer;
begin
  if p_key_hash is null or length(p_key_hash) <> 64
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 1 or p_window_seconds > 3600 then
    return false;
  end if;

  insert into public.recovery_auth_rate_limits as current_limit
    (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, now(), 1, now())
  on conflict (key_hash) do update
    set window_started_at = case
          when current_limit.window_started_at + make_interval(secs => p_window_seconds) <= now()
            then now()
          else current_limit.window_started_at
        end,
        request_count = case
          when current_limit.window_started_at + make_interval(secs => p_window_seconds) <= now()
            then 1
          else current_limit.request_count + 1
        end,
        updated_at = now()
  returning request_count into next_count;

  -- Opportunistic cleanup prevents expired limiter keys accumulating forever.
  if random() < 0.01 then
    delete from public.recovery_auth_rate_limits
     where updated_at < now() - interval '2 days';
  end if;

  return next_count <= p_limit;
end;
$$;

-- These functions are only for the trusted backend using the service role.
revoke all on function public.record_recovery_login_failure(uuid) from public, anon, authenticated;
revoke all on function public.allow_recovery_login_rate(text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_recovery_login_failure(uuid) to service_role;
grant execute on function public.allow_recovery_login_rate(text, integer, integer) to service_role;

comment on function public.record_recovery_login_failure(uuid) is
  'Atomically counts consecutive failed password attempts and locks an account for seven days after three failures.';
comment on table public.recovery_auth_rate_limits is
  'Private hashed keys for shared server-side login rate limiting.';
