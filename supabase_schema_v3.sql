-- ─── Redistribute.io — Schema V3 ─────────────────────────────────────────────
-- Run this file in Supabase SQL Editor after v1 and v2 schemas.
-- ──────────────────────────────────────────────────────────────────────────────

-- Caption Studio
CREATE TABLE IF NOT EXISTS captions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id             uuid REFERENCES uploaded_videos(id) ON DELETE CASCADE,
  clip_id              uuid REFERENCES clips(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES users(id) ON DELETE CASCADE,
  platform             text NOT NULL DEFAULT 'tiktok',
  srt_url              text,
  captioned_video_url  text,
  transcript_text      text,
  word_count           integer DEFAULT 0,
  style                jsonb,
  burn_in              boolean DEFAULT true,
  status               text NOT NULL DEFAULT 'pending',
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, clip_id, platform)
);

-- Best Time to Post (analytics already handled by video_analytics table from v3)
-- No new table needed — uses video_analytics + distributions

-- B-Roll Auto-Fill
CREATE TABLE IF NOT EXISTS broll_segments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id             uuid REFERENCES uploaded_videos(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES users(id) ON DELETE CASCADE,
  segment_index        integer NOT NULL,
  start_time           float NOT NULL,
  end_time             float NOT NULL,
  duration             float NOT NULL,
  status               text NOT NULL DEFAULT 'detected',  -- detected | applied | skipped
  pexels_video_id      text,
  pexels_attribution   text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broll_segments_video ON broll_segments(video_id);

-- Video Analytics (for Best Time to Post + Dashboard)
CREATE TABLE IF NOT EXISTS video_analytics (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id      uuid REFERENCES distributions(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES users(id) ON DELETE CASCADE,
  platform_video_id    text NOT NULL,
  platform             text NOT NULL,
  views                bigint DEFAULT 0,
  likes                bigint DEFAULT 0,
  comments             bigint DEFAULT 0,
  shares               bigint DEFAULT 0,
  fetched_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_analytics_dist   ON video_analytics(distribution_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_analytics_user   ON video_analytics(user_id, platform, fetched_at DESC);

-- Stripe event idempotency
CREATE TABLE IF NOT EXISTS stripe_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             text UNIQUE NOT NULL,
  type                 text NOT NULL,
  data                 jsonb,
  processed_at         timestamptz NOT NULL DEFAULT now()
);

-- User settings (watermark, preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  watermark_url        text,
  watermark_path       text,
  watermark_position   text DEFAULT 'bottom-right',
  watermark_opacity    float DEFAULT 0.7,
  watermark_enabled    boolean DEFAULT false,
  updated_at           timestamptz DEFAULT now()
);

-- Add missing columns to existing tables
ALTER TABLE distributions  ADD COLUMN IF NOT EXISTS error_code     text;
ALTER TABLE distributions  ADD COLUMN IF NOT EXISTS bullmq_job_id  text;
ALTER TABLE clips          ADD COLUMN IF NOT EXISTS ai_reason      text;
ALTER TABLE clips          ADD COLUMN IF NOT EXISTS viral_score    integer;
ALTER TABLE users          ADD COLUMN IF NOT EXISTS reposts_used_this_month integer DEFAULT 0;
ALTER TABLE users          ADD COLUMN IF NOT EXISTS reposts_reset_at         timestamptz DEFAULT date_trunc('month', now());

-- Increment reposts counter function
CREATE OR REPLACE FUNCTION increment_reposts_used(user_id_arg uuid)
RETURNS void AS $$
  UPDATE users
  SET reposts_used_this_month = reposts_used_this_month + 1
  WHERE id = user_id_arg;
$$ LANGUAGE sql;
