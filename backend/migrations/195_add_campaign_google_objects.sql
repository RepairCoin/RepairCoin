-- 195 — Google Ads push (Slice 3). Store the created Google object ids on the campaign, mirroring
-- the meta_* id columns, so status sync / go-live / insights can reference them. Idempotent.
-- NOTE: 192/193 reserved on the parked deo/inbound-email branch; 194 = google connect; this is 195.
-- See docs/tasks/strategy/ads-system/ads-google-ads-implementation-plan.md (Slice 3 / BE-3a).
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_campaign_id TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_ad_group_id TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_budget_id TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_status TEXT;
