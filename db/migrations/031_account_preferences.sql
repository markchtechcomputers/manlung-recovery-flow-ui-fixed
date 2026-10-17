-- Additional account profile fields for Manlung Community.
alter table public.recovery_chat_profiles
  add column if not exists birthday date,
  add column if not exists language text not null default 'en'
    check (language in ('en','sw','fr','es','ar'));
