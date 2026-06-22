-- 172 — Safeguard 5 (free creative iteration). A nightly check flags an underperforming live
-- campaign so the admin is nudged to swap the creative FOR FREE (the swap itself reuses the
-- existing regenerate/upload). Cleared when the creative is swapped.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS needs_creative_refresh BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creative_refresh_reason TEXT;
