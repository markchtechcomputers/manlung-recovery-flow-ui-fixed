-- Manlung Recovery: Owner-only Security & Monitoring
-- Adds durable Owner-controlled account security state.
--
-- IMPORTANT:
-- recovery_security_events already exists in migration 016.
-- Do not create a second/incompatible security-events table here.

alter table public.recovery_users
  add column if not exists security_status text not null default 'active',
  add column if not exists security_reason text,
  add column if not exists security_updated_at timestamptz,
  add column if not exists security_updated_by uuid
    references public.recovery_users(id)
    on delete set null;

alter table public.recovery_users
  drop constraint if exists recovery_users_security_status_check;

alter table public.recovery_users
  add constraint recovery_users_security_status_check
  check (
    security_status in (
      'active',
      'restricted',
      'suspended',
      'blocked'
    )
  );

create index if not exists recovery_users_security_status_idx
  on public.recovery_users(security_status);

comment on column public.recovery_users.security_status is
  'Owner-controlled account security state. Separate from failed-login lockout and admin_status.';

comment on column public.recovery_users.security_reason is
  'Reason supplied by the Owner for the current security state.';

comment on column public.recovery_users.security_updated_at is
  'Timestamp of the most recent Owner-controlled security state change.';

comment on column public.recovery_users.security_updated_by is
  'User ID of the Owner who most recently changed the security state.';
