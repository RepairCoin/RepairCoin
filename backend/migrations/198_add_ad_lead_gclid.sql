-- 198 — Google conversion-optimization, Phase 1 (signal capture). Store the Google click id
-- (gclid, from Google auto-tagging on the landing URL) on the lead, so a later phase can upload an
-- offline click conversion to Google when the lead converts to a booking. Idempotent.
-- See docs/tasks/strategy/ads-system/ads-google-conversion-optimization-scope.md (Phase 1).
ALTER TABLE ad_leads ADD COLUMN IF NOT EXISTS gclid TEXT;
