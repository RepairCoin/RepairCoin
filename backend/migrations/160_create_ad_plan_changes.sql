-- Ads System — lifecycle Phase 4: tier-change history + subscription status.
--
-- ad_plan_changes records every tier change (audit + the scheduled-downgrade mechanism):
--   upgrade   → applied immediately, prorated charge recorded (decision #1)
--   downgrade → 'scheduled' until the next billing cycle, then applied by the nightly job
--   cancel    → subscription ends at period end
-- subscription_status on ad_billing_plans drives dunning (§9.1) + cancel (§9.3).

CREATE TABLE IF NOT EXISTS ad_plan_changes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  from_tier             TEXT,
  to_tier               TEXT,
  kind                  TEXT NOT NULL CHECK (kind IN ('upgrade','downgrade','cancel')),
  status                TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','scheduled','cancelled')),
  effective_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  prorated_amount_cents INTEGER NOT NULL DEFAULT 0,   -- + = upgrade charge owed now
  requested_by          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_plan_changes_shop ON ad_plan_changes (shop_id, created_at);
-- find due scheduled downgrades quickly
CREATE INDEX IF NOT EXISTS idx_ad_plan_changes_scheduled
  ON ad_plan_changes (status, effective_at) WHERE status = 'scheduled';

ALTER TABLE ad_billing_plans
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','past_due','paused','cancelled'));
