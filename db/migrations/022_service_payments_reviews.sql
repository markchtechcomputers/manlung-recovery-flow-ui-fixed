create table if not exists public.recovery_service_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  email text not null,
  customer_name text,
  amount_kes integer not null check (amount_kes in (200,500,1000)),
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  paystack_transaction_id text,
  paid_at timestamptz,
  review_submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recovery_service_payments_email_idx on public.recovery_service_payments(email);
create table if not exists public.recovery_service_reviews (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique references public.recovery_service_payments(reference) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 1 and 1200),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recovery_service_payments enable row level security;
alter table public.recovery_service_reviews enable row level security;
