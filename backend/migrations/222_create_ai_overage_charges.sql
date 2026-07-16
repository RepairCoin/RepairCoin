-- AI Usage Overage (T3.2) Slice 2: monthly overage accrual ledger. One row per shop per month.
-- When a shop with overage enabled spends past its allowance, the marginal FixFlow AI cost beyond the
-- cap is accrued here; amount_cents = overage_cost_cents x multiplier (default 3 = "Usage x3"). Slice 3
-- invoices the `pending` rows via Stripe. Additive + idempotent. Mirrors the ads ad_billing_charges shape.
-- Plan: docs/tasks/strategy/pricing-alignment/ai-usage-overage-implementation-plan.md
CREATE TABLE IF NOT EXISTS ai_overage_charges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  period_month       DATE NOT NULL,                     -- first day of the month (UTC)
  overage_cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,  -- actual AI cost incurred beyond the allowance
  multiplier         NUMERIC(6,2) NOT NULL DEFAULT 3.0, -- "Usage x3"
  amount_cents       NUMERIC(12,4) NOT NULL DEFAULT 0,  -- billable = overage_cost_cents * multiplier
  status             TEXT NOT NULL DEFAULT 'pending',   -- pending | invoiced | paid | void
  stripe_invoice_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One accrual row per shop per month → idempotent upsert accumulates into it.
  CONSTRAINT uq_ai_overage_shop_month UNIQUE (shop_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_ai_overage_charges_status ON ai_overage_charges (status, period_month);
