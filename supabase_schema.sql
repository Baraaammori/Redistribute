-- ─────────────────────────────────────────────────────────────────────────────
-- Redistribute.io — Supabase SQL Schema
-- Run this in: supabase.com → your project → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- USERS
create table if not exists public.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  password_hash       text not null,
  name                text,
  plan                text not null default 'free',   -- 'free' | 'pro' | 'team'
  trial_ends_at       timestamptz,
  stripe_customer_id  text unique,
  stripe_sub_id       text unique,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- PLATFORM ACCOUNTS (one per platform per user)
create table if not exists public.platform_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  platform        text not null,               -- 'youtube' | 'tiktok' | 'instagram'
  handle          text,
  display_name    text,
  avatar_url      text,
  follower_count  int,
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz,
  connected_at    timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(user_id, platform)
);

-- REPOSTS
create table if not exists public.reposts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  source_account_id uuid references public.platform_accounts(id),
  source_video_id   text,
  source_video_url  text,
  title             text,
  thumbnail_url     text,
  destinations      text[] not null,           -- e.g. ['youtube', 'tiktok']
  scheduled_for     timestamptz,
  status            text not null default 'pending',
  -- 'pending' | 'scheduled' | 'processing' | 'done' | 'failed'
  error             text,
  job_id            text,
  results           jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- SHOP ITEMS
create table if not exists public.shop_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       numeric(10,2) not null,
  category    text,
  description text,
  image_url   text,
  stock       int default 0,
  created_at  timestamptz default now()
);

-- INDEXES
create index if not exists reposts_user_id_idx      on public.reposts(user_id);
create index if not exists reposts_status_idx       on public.reposts(status);
create index if not exists reposts_scheduled_idx    on public.reposts(scheduled_for);
create index if not exists accounts_user_id_idx     on public.platform_accounts(user_id);

-- ROW LEVEL SECURITY (enable so users only see their own data)
alter table public.users            enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.reposts          enable row level security;
alter table public.shop_items       enable row level security;

-- Backend uses SERVICE_ROLE key which bypasses RLS — no policies needed for server.
-- If you add a client-side Supabase call later, add policies here.

-- SAMPLE SHOP ITEMS (optional seed)
insert into public.shop_items (name, price, category, description, stock) values
  ('DJI Mic 2 Wireless', 249.00, 'Audio',    'Compact wireless microphone for creators', 12),
  ('Elgato Key Light Air', 129.00, 'Lighting', 'App-controlled key light, 1400 lumens', 8),
  ('GoPro HERO 12 Black', 399.00, 'Camera',   'Waterproof action camera, 5.3K video', 5),
  ('Blue Yeti USB Microphone', 99.00, 'Audio', 'USB condenser mic with multiple patterns', 20),
  ('Godox SL60W LED', 159.00, 'Lighting',     '60W daylight LED video light', 15)
on conflict do nothing;
