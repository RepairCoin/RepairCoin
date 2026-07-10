-- 194 — Google Ads connect (Google plan, Slice 1). Per-shop Google Ads OAuth connection: the shop
-- authorizes FixFlow to manage its OWN Google Ads account (model A). Mirrors the meta_oauth_* columns.
-- refresh_token is stored ENCRYPTED (app-layer). google_ads_connected = the derived gate (set once a
-- customer is selected). Idempotent.
-- NOTE: 192/193 are reserved on the parked deo/inbound-email branch — this is 194 on the main line.
-- See docs/tasks/strategy/ads-google-ads-implementation-plan.md (Slice 1 / BE-1).
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_ads_manager_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_ads_connected BOOLEAN NOT NULL DEFAULT false;
