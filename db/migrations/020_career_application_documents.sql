alter table public.career_applications
  add column if not exists cv_path text,
  add column if not exists cv_filename text,
  add column if not exists cover_letter_path text,
  add column if not exists cover_letter_filename text;

notify pgrst, 'reload schema';
