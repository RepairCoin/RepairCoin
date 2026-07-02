-- 197 — Google Ads two-way config sync (Slice 5). Track when each campaign's budget/status were last
-- reconciled FROM Google (distinct from google_last_synced_at, which is insights). Mirrors
-- meta_synced_config_at. Idempotent.
-- See docs/tasks/strategy/ads-system/ads-google-ads-implementation-plan.md (Slice 5).
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_synced_config_at TIMESTAMPTZ;
