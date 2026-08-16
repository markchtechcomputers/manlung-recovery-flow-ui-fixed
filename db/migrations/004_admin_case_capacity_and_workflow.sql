-- Manlung Recovery: allow each Admin/Owner to actively handle up to 10 cases.
-- Run after migrations 002 and 003.

create or replace function claim_recovery_case(p_case_id text, p_admin_id uuid)
returns recovery_cases
language plpgsql
security definer
set search_path = public
as $$
declare result recovery_cases; active_count integer;
begin
  select count(*) into active_count
  from recovery_cases
  where assigned_admin_id = p_admin_id
    and status not in ('Recovery Successful','Recovered by Police','Recovered by Owner','Closed','Rejected');

  if active_count >= 10 then
    raise exception 'ADMIN_CASE_LIMIT_REACHED';
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

  if result.id is null then raise exception 'CASE_ALREADY_CLAIMED_OR_UNAVAILABLE'; end if;
  return result;
end;
$$;
