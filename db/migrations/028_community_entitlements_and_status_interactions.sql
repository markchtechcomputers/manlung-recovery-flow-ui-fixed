-- Manlung community entitlements, status interactions, and persistent hiding.
-- Server-mediated access only: keep service-role credentials on the server.
create table if not exists public.recovery_chat_plan_purchases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 provider text not null default 'paystack' check(provider='paystack'),
 provider_reference text not null unique,
 provider_transaction_id text unique,
 plan_code text not null check(plan_code in ('plus','pro','chat_pass','call')),
 amount_kes integer not null check(amount_kes in (100,200,500)),
 currency text not null default 'KES' check(currency='KES'),
 status text not null default 'pending' check(status in ('pending','paid','failed','cancelled','reversed')),
 starts_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists recovery_chat_plan_purchase_user_idx
 on public.recovery_chat_plan_purchases(user_id,plan_code,status,expires_at desc);
create table if not exists public.recovery_chat_status_comments (
 id uuid primary key default gen_random_uuid(),
 status_id uuid not null references public.recovery_chat_status_posts(id) on delete cascade,
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 comment text not null check(char_length(trim(comment)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists recovery_chat_status_comments_idx
 on public.recovery_chat_status_comments(status_id,created_at asc);
create table if not exists public.recovery_chat_status_hides (
 user_id uuid not null references public.recovery_users(id) on delete cascade,
 status_id uuid not null references public.recovery_chat_status_posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,status_id)
);
alter table public.recovery_chat_plan_purchases enable row level security;
alter table public.recovery_chat_status_comments enable row level security;
alter table public.recovery_chat_status_hides enable row level security;
revoke all on table public.recovery_chat_plan_purchases,public.recovery_chat_status_comments,public.recovery_chat_status_hides from anon,authenticated;

create or replace function public.recovery_chat_fulfill_plan_purchase(p_purchase_id uuid,p_provider_transaction_id text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.recovery_chat_plan_purchases%rowtype;
begin
 select * into p from public.recovery_chat_plan_purchases where id=p_purchase_id for update;
 if not found then raise exception 'PLAN_PURCHASE_NOT_FOUND'; end if;
 if p.status='paid' then return false; end if;
 if p.status<>'pending' or p_provider_transaction_id is null or length(trim(p_provider_transaction_id))=0 then
  raise exception 'PLAN_PURCHASE_INVALID';
 end if;
 update public.recovery_chat_plan_purchases set status='paid',provider_transaction_id=p_provider_transaction_id,
   starts_at=now(),expires_at=now()+interval '30 days',paid_at=now() where id=p_purchase_id;
 return true;
end $$;
revoke all on function public.recovery_chat_fulfill_plan_purchase(uuid,text) from public,anon,authenticated;
grant execute on function public.recovery_chat_fulfill_plan_purchase(uuid,text) to service_role;
notify pgrst,'reload schema';
