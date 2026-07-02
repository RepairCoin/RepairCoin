-- 199 — Google conversion-optimization, Phase 2 (report conversions to Google). Two additions:
--   ad_leads.conversion_uploaded_at  — idempotency marker so a lead's offline conversion is
--                                       uploaded to Google at most once.
--   shops.google_ads_conversion_action — cached resource name of the shop's FixFlow "Lead"
--                                         conversion action (resolved/created once, then reused).
-- Idempotent. See docs/tasks/strategy/ads-system/ads-google-conversion-optimization-scope.md (Phase 2).
ALTER TABLE ad_leads ADD COLUMN IF NOT EXISTS conversion_uploaded_at TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_ads_conversion_action TEXT;
