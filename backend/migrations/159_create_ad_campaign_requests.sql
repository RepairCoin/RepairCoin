-- Ads System — lifecycle Phase 3: recurring campaign requests.
--
-- A shop asks for a campaign (with a brief) as many times as it wants over the
-- relationship — decoupled from the one-shot opt-in. Each request is capacity-checked
-- against the tier limit (§9.5) and, when the admin builds it, links to a real
-- ad_campaigns row. The brief fields mirror the ones added to ad_enrollment_requests
-- (the opt-in keeps the FIRST campaign's brief; 2nd+ go through this table).

CREATE TABLE IF NOT EXISTS ad_campaign_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  -- campaign brief (optional)
  promote_service_ids  TEXT[] NOT NULL DEFAULT '{}',
  monthly_budget_cents INTEGER CHECK (monthly_budget_cents IS NULL OR monthly_budget_cents >= 0),
  offer                TEXT,
  target_radius_miles  INTEGER CHECK (target_radius_miles IS NULL OR target_radius_miles BETWEEN 1 AND 100),
  goal                 TEXT CHECK (goal IS NULL OR goal IN ('more_bookings','awareness','promote_service')),
  message              TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','building','live','declined','cancelled')),
  campaign_id          UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL,  -- set when admin builds it
  decline_reason       TEXT,
  decided_by           TEXT,
  decided_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_requests_shop ON ad_campaign_requests (shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_requests_status ON ad_campaign_requests (status);
