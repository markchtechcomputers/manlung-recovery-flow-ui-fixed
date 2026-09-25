-- Owner-managed complimentary call access.
alter table public.recovery_call_entitlements
  add column if not exists free_access_until timestamptz,
  add column if not exists free_access_granted_by uuid references public.recovery_users(id) on delete set null,
  add column if not exists free_access_granted_at timestamptz;

create index if not exists recovery_call_entitlements_free_access_idx
  on public.recovery_call_entitlements(free_access_until);

notify pgrst, 'reload schema';
