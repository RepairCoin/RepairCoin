-- Ads System (Q6) — per-campaign AI cost ledger.
--
-- AI inference cost (e.g. drafting lead outreach) is FixFlow COGS. Per Q6 it is
-- EXCLUDED from the shop-facing ROI but MUST be tracked internally per campaign so
-- the admin "true margin" panel can show FixFlow's real cost of delivery — load-
-- bearing for pricing Plan B (margin) and Plan C (per-booking). Each AI call that
-- serves a campaign appends one row here; the shop-level monthly cap in
-- ai_shop_settings is unchanged (this is an additional, attributable ledger).

CREATE TABLE IF NOT EXISTS ad_ai_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES ad_leads(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL DEFAULT 'draft_outreach',
  -- NUMERIC, not INTEGER: a single AI draft costs fractions of a cent (~$0.0003 =
  -- 0.03c); integer cents would round every row to 0. Aggregate, then round at read.
  cost_cents  NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_ai_costs_campaign ON ad_ai_costs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_ai_costs_created ON ad_ai_costs(created_at);
