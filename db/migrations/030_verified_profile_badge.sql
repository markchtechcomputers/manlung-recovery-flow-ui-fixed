-- Paid blue verified profile badge (KES 100, one-time).
alter table public.recovery_chat_profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_source text not null default 'none'
    check (verification_source in ('none','paid','official'));

create table if not exists public.recovery_chat_verification_purchases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 provider text not null default 'paystack' check(provider='paystack'),
 provider_reference text not null unique,
 provider_transaction_id text unique,
 amount_kes integer not null default 100 check(amount_kes=100),
 currency text not null default 'KES' check(currency='KES'),
 status text not null default 'pending' check(status in ('pending','paid','failed','cancelled','reversed')),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists recovery_chat_verification_purchase_user_idx
 on public.recovery_chat_verification_purchases(user_id,created_at desc);
alter table public.recovery_chat_verification_purchases enable row level security;
revoke all on table public.recovery_chat_verification_purchases from anon,authenticated;

create or replace function public.recovery_chat_fulfill_verification_purchase(p_purchase_id uuid,p_provider_transaction_id text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.recovery_chat_verification_purchases%rowtype;
begin
 select * into p from public.recovery_chat_verification_purchases where id=p_purchase_id for update;
 if not found then raise exception 'VERIFICATION_PURCHASE_NOT_FOUND'; end if;
 if p.status='paid' then return false; end if;
 if p.status<>'pending' or p.amount_kes<>100 or p.currency<>'KES'
   or p_provider_transaction_id is null or length(trim(p_provider_transaction_id))=0 then
  raise exception 'VERIFICATION_PURCHASE_INVALID';
 end if;
 update public.recovery_chat_verification_purchases set status='paid',provider_transaction_id=p_provider_transaction_id,paid_at=now() where id=p_purchase_id;
 update public.recovery_chat_profiles set is_verified=true,verified_at=coalesce(verified_at,now()),verification_source='paid',updated_at=now() where user_id=p.user_id;
 if not found then
  insert into public.recovery_chat_profiles(user_id,display_name,is_verified,verified_at,verification_source)
  select id,coalesce(nullif(trim(username),''),'Member'),true,now(),'paid' from public.recovery_users where id=p.user_id
  on conflict(user_id) do update set is_verified=true,verified_at=coalesce(public.recovery_chat_profiles.verified_at,now()),verification_source='paid',updated_at=now();
 end if;
 return true;
end $$;
revoke all on function public.recovery_chat_fulfill_verification_purchase(uuid,text) from public,anon,authenticated;
grant execute on function public.recovery_chat_fulfill_verification_purchase(uuid,text) to service_role;

-- Mark Eng Mark as officially verified, even if no chat profile row exists yet.
-- Resolve by either profile display name or registered username, then upsert the profile.
insert into public.recovery_chat_profiles
  (user_id,display_name,is_verified,verified_at,verification_source,updated_at)
select u.id,coalesce(nullif(trim(p.display_name),''),nullif(trim(u.username),''),'Eng Mark'),
       true,now(),'official',now()
from public.recovery_users u
left join public.recovery_chat_profiles p on p.user_id=u.id
where lower(trim(coalesce(p.display_name,'')))='eng mark'
   or lower(trim(coalesce(u.username,'')))='eng mark'
on conflict (user_id) do update
set is_verified=true,
    verified_at=coalesce(public.recovery_chat_profiles.verified_at,now()),
    verification_source='official',
    updated_at=now();
notify pgrst,'reload schema';
