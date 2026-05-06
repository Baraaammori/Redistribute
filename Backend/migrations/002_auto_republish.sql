-- Migration 002: Auto-republish feature
-- Run against the Supabase SQL editor or via your migration tool.

-- ── platform_accounts: new columns ───────────────────────────────────────────
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS auto_republish_enabled BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_republish_targets TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_seen_video_id     TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_polled_at         TIMESTAMPTZ DEFAULT NULL;

-- ── auto_republish_jobs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_republish_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  source_platform  TEXT        NOT NULL,
  source_video_id  TEXT        NOT NULL,
  video_title      TEXT,
  video_url        TEXT,
  target_platforms TEXT[]      NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending',
  error_message    TEXT,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_arj_user_id      ON auto_republish_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_arj_status       ON auto_republish_jobs (status);
CREATE INDEX IF NOT EXISTS idx_arj_triggered_at ON auto_republish_jobs (triggered_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE auto_republish_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
DROP POLICY IF EXISTS "Users access own auto_republish_jobs" ON auto_republish_jobs;
CREATE POLICY "Users access own auto_republish_jobs"
  ON auto_republish_jobs
  USING (auth.uid() = user_id);

-- Users can update auto_republish_enabled only on their own rows
DROP POLICY IF EXISTS "Users update own auto_republish settings" ON platform_accounts;
CREATE POLICY "Users update own auto_republish settings"
  ON platform_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);
