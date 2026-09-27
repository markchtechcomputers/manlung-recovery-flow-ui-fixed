-- Remote support sessions remain active until the admin or device ends them.
-- Device enrollment tokens remain short-lived; this only removes the
-- remote-session expiry so an authorized session can stay connected while
-- the device remains online and the consented browser capture is active.
alter table public.remote_sessions
  alter column expires_at drop not null;
