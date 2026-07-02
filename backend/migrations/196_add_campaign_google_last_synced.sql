-- 196 — Google Ads insights (Slice 4). Track when each campaign's spend/impressions/clicks were last
-- imported from Google (nightly GAQL pull), mirroring meta_last_synced_at. Idempotent.
-- 192/193 reserved on the parked deo/inbound-email branch; 194 = google connect, 195 = google objects.
-- See docs/tasks/strategy/ads-system/ads-google-ads-implementation-plan.md (Slice 4).
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ;
