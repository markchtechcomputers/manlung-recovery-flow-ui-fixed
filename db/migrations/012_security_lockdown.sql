-- Manlung Recovery: database/storage security lockdown.
-- Run after migration 011. This does not modify Supabase Auth.
--
-- The Node.js backend uses the server-only service_role key for privileged
-- database work. RLS therefore blocks accidental direct access through the
-- public/anon Supabase API while preserving the existing application flow.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recovery_users',
    'recovery_cases',
    'recovery_call_sessions',
    'recovery_call_signals',
    'recovery_call_subscriptions',
    'recovery_call_entitlements',
    'recovery_admin_presence',
    'recovery_admin_audit_log',
    'admin_permissions',
    'admin_invitations',
    'case_timeline',
    'case_messages',
    'notifications',
    'career_applications',
    'recovery_donations'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

-- Evidence must remain private. The application creates short-lived signed
-- URLs after checking the caller's case/role permissions.
update storage.buckets
set public = false
where id = 'recovery-evidence';

-- No browser session needs direct access to the evidence bucket. All reads
-- and writes go through the server, which issues short-lived signed URLs.
revoke select, insert, update, delete on table storage.objects
  from anon, authenticated;

-- Security-definer functions are never public API endpoints. The backend
-- invokes them using the server-only service role.
revoke execute on function public.claim_recovery_case(text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_recovery_case(text, uuid)
  to service_role;

revoke execute on function public.complete_recovery_case(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_recovery_case(text, uuid, text)
  to service_role;

revoke execute on function public.enforce_one_active_call_per_admin()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
