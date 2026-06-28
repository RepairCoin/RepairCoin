-- 182 — Safeguard 5 (free creative iteration). RENUMBERED from 172 to resolve a collision with
-- main's 172_add_shop_trial_tracking.sql (kept canonical). Staging already recorded version 172 as
-- this migration; on staging it stays applied and main's 172 (shop_trial) is applied separately,
-- while a fresh prod runs both (172 shop_trial, 182 this). A nightly check flags an underperforming
-- live campaign so the admin is nudged to swap the creative FOR FREE (reuses regenerate/upload).
-- Cleared when the creative is swapped. Idempotent (IF NOT EXISTS).

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS needs_creative_refresh BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creative_refresh_reason TEXT;
