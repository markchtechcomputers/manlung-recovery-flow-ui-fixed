-- ============================================================
-- Manlung Recovery
-- Notifications + Case Timeline
-- ============================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  case_id text null,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on notifications(user_id);

create index if not exists notifications_case_id_idx
  on notifications(case_id);

create index if not exists notifications_unread_idx
  on notifications(user_id, read_at);

create table if not exists case_timeline (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  actor_user_id uuid null,
  event_type text not null,
  description text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists case_timeline_case_id_idx
  on case_timeline(case_id);

create index if not exists case_timeline_created_at_idx
  on case_timeline(case_id, created_at);

-- ============================================================
-- Row Level Security
-- Server-side code uses the Supabase service-role key.
-- Clients must still be protected by application authorization.
-- ============================================================

alter table notifications enable row level security;
alter table case_timeline enable row level security;
