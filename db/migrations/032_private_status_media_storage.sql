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

-- Keep this bucket private. Do not add authenticated/anon object policies for this bucket;
-- the server's service-role client uploads files and issues signed URLs.
notify pgrst, 'reload schema';
