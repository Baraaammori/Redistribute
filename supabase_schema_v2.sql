-- ─────────────────────────────────────────────────────────────────────────────
-- Redistribute.io — Schema V2: Upload + Smart Engine + Clips
-- Run this AFTER supabase_schema.sql in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- UPLOADED VIDEOS (user uploads from computer)
create table if not exists public.uploaded_videos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  title             text not null,
  description       text,
  tags              text[],
  thumbnail_url     text,
  file_url          text not null,          -- Supabase Storage URL
  file_path         text,                   -- Storage path for deletion
  file_size         bigint,
  duration_seconds  float,
  width             int,
  height            int,
  orientation       text,                   -- 'vertical' | 'horizontal' | 'square'
  aspect_ratio      text,                   -- '16:9', '9:16', '1:1', etc.
  fps               float,
  codec             text,
  status            text not null default 'uploaded',
  -- 'uploaded' | 'analyzing' | 'analyzed' | 'processing' | 'distributing' | 'done' | 'failed'
  mode              text default 'auto',    -- 'auto' | 'manual' | 'custom'
  smart_decision    jsonb,                  -- Smart engine output
  error             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- CLIPS (generated from uploaded videos)
create table if not exists public.clips (
  id                uuid primary key default gen_random_uuid(),
  video_id          uuid not null references public.uploaded_videos(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  file_url          text not null,
  file_path         text,
  start_time        float not null,
  end_time          float not null,
  duration_seconds  float not null,
  width             int,
  height            int,
  title             text,
  platform          text,                   -- 'tiktok' | 'youtube_shorts'
  status            text not null default 'generated',
  -- 'generated' | 'approved' | 'uploading' | 'uploaded' | 'failed'
  platform_video_id text,                   -- ID returned by platform after upload
  platform_url      text,
  error             text,
  created_at        timestamptz default now()
);

-- JOB LOGS (audit trail for dashboard)
create table if not exists public.job_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  video_id    uuid references public.uploaded_videos(id) on delete set null,
  clip_id     uuid references public.clips(id) on delete set null,
  action      text not null,               -- 'upload' | 'analyze' | 'clip' | 'distribute' | 'error'
  platform    text,                        -- 'youtube' | 'tiktok' | 'youtube_shorts'
  details     jsonb,
  status      text not null default 'info', -- 'info' | 'success' | 'warning' | 'error'
  created_at  timestamptz default now()
);

-- DISTRIBUTIONS (tracks each platform upload separately)
create table if not exists public.distributions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  video_id          uuid references public.uploaded_videos(id) on delete cascade,
  clip_id           uuid references public.clips(id) on delete cascade,
  repost_id         uuid references public.reposts(id) on delete cascade,
  platform          text not null,           -- 'youtube' | 'tiktok' | 'youtube_shorts' | 'instagram'
  upload_type       text not null default 'full', -- 'full' | 'clip' | 'shorts'
  platform_video_id text,
  platform_url      text,
  status            text not null default 'queued',
  -- 'queued' | 'uploading' | 'success' | 'failed'
  error             text,
  retry_count       int default 0,
  scheduled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz default now()
);

-- INDEXES
create index if not exists uploaded_videos_user_idx    on public.uploaded_videos(user_id);
create index if not exists uploaded_videos_status_idx  on public.uploaded_videos(status);
create index if not exists clips_video_idx             on public.clips(video_id);
create index if not exists clips_user_idx              on public.clips(user_id);
create index if not exists job_logs_user_idx           on public.job_logs(user_id);
create index if not exists job_logs_video_idx          on public.job_logs(video_id);
create index if not exists distributions_user_idx      on public.distributions(user_id);
create index if not exists distributions_video_idx     on public.distributions(video_id);
create index if not exists distributions_status_idx    on public.distributions(status);

-- RLS
alter table public.uploaded_videos enable row level security;
alter table public.clips            enable row level security;
alter table public.job_logs         enable row level security;
alter table public.distributions    enable row level security;
