-- 242 — In-app ad placement clicks. The ads product (ad_campaigns) previously only ran on
-- Meta/Google; this table backs the first *in-app* placement — sponsored cards rendered inside
-- the customer app (initially the Trending Services grid). One row per tap.
--
-- `placement` identifies the surface so additional screens can reuse this table without another
-- migration. Impressions are intentionally NOT tracked in v1 (needs viewability logic).
-- Idempotent.
CREATE TABLE IF NOT EXISTS ad_app_placement_clicks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  customer_address TEXT,                                        -- lowercase wallet; null if unresolved
  placement        TEXT NOT NULL DEFAULT 'trending_services',    -- surface the card was tapped on
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_app_clicks_campaign
  ON ad_app_placement_clicks (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_app_clicks_placement
  ON ad_app_placement_clicks (placement, created_at DESC);
