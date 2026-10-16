-- Private storage for Manlung Recovery status images.
-- The backend uses the Supabase service role to upload and create short-lived signed URLs.
-- No public bucket access is granted. Run against the same Supabase project as the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recovery-chat-status-media',
  'recovery-chat-status-media',
  false,
  1048576,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Prevent direct client access; server-side service-role operations bypass these client policies.
drop policy if exists "status media client read" on storage.objects;
drop policy if exists "status media client write" on storage.objects;
create policy "status media client read" on storage.objects
  for select to authenticated
  using (bucket_id <> 'recovery-chat-status-media');
create policy "status media client write" on storage.objects
  for insert to authenticated
  with check (bucket_id <> 'recovery-chat-status-media');

notify pgrst, 'reload schema';
