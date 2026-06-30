-- 191 — Multi-channel foundation (Google Ads plan). Persist the chosen ad channel on a campaign
-- request so the admin build path knows which platform to create (meta | google). NULL = meta
-- (the default, today's behaviour). ad_campaigns.platform already exists; this carries the choice
-- from the shop's brief through to build. Idempotent.
-- See docs/tasks/strategy/ads-system/ads-google-ads-implementation-plan.md (Slice 2 completion + Slice 6 gate).
ALTER TABLE ad_campaign_requests ADD COLUMN IF NOT EXISTS channel TEXT;
