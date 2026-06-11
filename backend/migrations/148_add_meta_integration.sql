-- 148_add_meta_integration.sql
--
-- Ads System Stage 4 — Meta API integration. Additive columns:
--   * shops: encrypted Meta OAuth tokens (encryption is app-layer; column TEXT).
--   * ad_campaigns.meta_campaign_id: maps our campaign to the Meta campaign so
--     webhook leads + insights spend attribute back to the right ad_campaign.
--   * ad_leads.meta_lead_id: the Meta leadgen id — idempotency on webhook re-delivery.
--   * service_orders: CAPI (Conversions API) reservation — design only, not sent in v1.
-- See docs/tasks/strategy/ads-system/ (Stage 4).

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS meta_oauth_token         TEXT,
  ADD COLUMN IF NOT EXISTS meta_oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_oauth_expires_at     TIMESTAMPTZ;

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_meta ON ad_campaigns (meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;

ALTER TABLE ad_leads
  ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;
-- Unique so a re-delivered Meta lead can't create a second row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_leads_meta_lead ON ad_leads (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS meta_conversion_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_conversion_sent_at  TIMESTAMPTZ;
