-- Ads System (Q4/Q7) — Plan A/B/C ad-management billing (rides ON TOP of the
-- $500/mo base subscription; never replaces it).
--
--   Plan A — $299/mo dashboard fee; shop pays Facebook directly (no margin).
--   Plan B (default, Q7) — FixFlow charges managed spend + markup; margin =
--            charged - actual ($120 charged / $100 actual = 20% markup).
--   Plan C — pay-per-result: $50 per confirmed booking OR 10% of booking revenue.
--
-- FixFlow's revenue accrues per campaign per day from ad_performance_daily; this is
-- the revenue side of the admin true-margin view (the AI-cost side is migration 150).
-- ACTUAL money movement (pushing a Stripe invoice) is gated behind a flag + Stripe
-- metered-price setup; this schema records what is OWED regardless.

-- One ad-management plan per shop.
CREATE TABLE IF NOT EXISTS ad_billing_plans (
  shop_id               TEXT PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  plan_type             TEXT NOT NULL DEFAULT 'b' CHECK (plan_type IN ('a','b','c')),
  -- Plan B: markup on managed ad spend, in basis points (2000 = 20%).
  markup_bps            INTEGER NOT NULL DEFAULT 2000 CHECK (markup_bps >= 0),
  -- Plan A: flat monthly dashboard fee (cents).
  dashboard_fee_cents   INTEGER NOT NULL DEFAULT 29900 CHECK (dashboard_fee_cents >= 0),
  -- Plan C: per-confirmed-booking fee (cents) OR revenue share (bps); model picks one.
  per_booking_fee_cents INTEGER NOT NULL DEFAULT 5000 CHECK (per_booking_fee_cents >= 0),
  revenue_share_bps     INTEGER NOT NULL DEFAULT 1000 CHECK (revenue_share_bps >= 0),
  plan_c_model          TEXT NOT NULL DEFAULT 'per_booking' CHECK (plan_c_model IN ('per_booking','revenue_share')),
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accrued FixFlow revenue. One row per (campaign, day, type) for B/C; per (shop,
-- month, type) for Plan A's flat fee (campaign_id NULL).
CREATE TABLE IF NOT EXISTS ad_billing_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  campaign_id      UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  period_date      DATE NOT NULL,
  charge_type      TEXT NOT NULL CHECK (charge_type IN
                     ('plan_a_dashboard','plan_b_margin','plan_c_booking','plan_c_revenue_share')),
  -- What the charge derived from (actual spend, or booking revenue) — for audit.
  basis_cents      INTEGER NOT NULL DEFAULT 0,
  -- FixFlow's revenue from this charge (cents).
  amount_cents     INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invoiced','paid','void')),
  stripe_invoice_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent accrual: re-running the nightly job UPDATES the day's charge in place.
-- Two partial uniques because campaign_id is NULL for Plan A (NULLs are distinct).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_billing_charge_campaign
  ON ad_billing_charges (campaign_id, period_date, charge_type) WHERE campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_billing_charge_shop
  ON ad_billing_charges (shop_id, period_date, charge_type) WHERE campaign_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_billing_charges_shop ON ad_billing_charges (shop_id);
