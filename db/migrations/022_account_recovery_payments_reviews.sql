create table if not exists public.recovery_service_payments (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 customer_email text not null,
 package_name text not null check(package_name in ('Basic Support','Standard Support','Premium Support')),
 amount_kes integer not null check(amount_kes in (200,500,1000)),
 currency text not null default 'KES' check(currency='KES'),
 status text not null default 'pending' check(status in ('pending','confirmed','failed','refunded')),
 paystack_transaction_id text,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists recovery_service_payments_status_created_idx on public.recovery_service_payments(status,created_at desc);
create table if not exists public.recovery_service_reviews (
 id uuid primary key default gen_random_uuid(),
 payment_reference text not null unique references public.recovery_service_payments(reference) on delete restrict,
 display_name text not null check(char_length(display_name) between 2 and 60),
 rating smallint not null check(rating between 1 and 5),
 review_text text not null check(char_length(review_text) between 10 and 1000),
 status text not null default 'published' check(status in ('pending','published','hidden')),
 created_at timestamptz not null default now()
);
create index if not exists recovery_service_reviews_public_idx on public.recovery_service_reviews(status,created_at desc);
alter table public.recovery_service_payments enable row level security;
alter table public.recovery_service_reviews enable row level security;
revoke all on public.recovery_service_payments from anon,authenticated;
revoke all on public.recovery_service_reviews from anon,authenticated;