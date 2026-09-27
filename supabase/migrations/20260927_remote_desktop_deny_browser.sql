-- Defense-in-depth deny-all policies for remote-control tables.
-- The Node backend uses a server-side secret and performs its own admin/device
-- authorization. Browser Data API roles must never read or mutate these rows.

create policy "remote_devices_deny_browser"
  on public.remote_devices
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "remote_sessions_deny_browser"
  on public.remote_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "remote_session_signals_deny_browser"
  on public.remote_session_signals
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "remote_audit_events_deny_browser"
  on public.remote_audit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
