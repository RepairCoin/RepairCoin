-- Ads System — Flat-tier ad-management billing ($199 / $499 / $999).
--
-- Decision (2026-06-15): the flat tiers are the SOLE ads-billing model. The shop
-- pays ad-spend DIRECTLY on its own account (FixFlow never fronts/holds/passes-through
-- spend), so billing is purely a configurable flat monthly fee — the same machinery
-- as Plan A's dashboard fee, just with a selectable amount + tier label.
--   Starter  = $199/mo  (flat_fee_cents 19900)
--   Growth   = $499/mo  (flat_fee_cents 49900)
--   Business = $999/mo  (flat_fee_cents 99900)
-- Plan A/B/C are retired from the UI but kept dormant in code; no data migration
-- (ads billing is staging-only / flag-gated, no prod A/B/C rows).

-- 1) Flat-fee config on the per-shop plan row.
ALTER TABLE ad_billing_plans
  ADD COLUMN IF NOT EXISTS flat_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (flat_fee_cents >= 0);
ALTER TABLE ad_billing_plans
  ADD COLUMN IF NOT EXISTS flat_tier_name TEXT;   -- 'starter' | 'growth' | 'business' (reporting/UX)

-- 2) Allow the new 'flat' plan type (auto-named inline CHECK from migration 151).
ALTER TABLE ad_billing_plans DROP CONSTRAINT IF EXISTS ad_billing_plans_plan_type_check;
ALTER TABLE ad_billing_plans
  ADD CONSTRAINT ad_billing_plans_plan_type_check CHECK (plan_type IN ('a','b','c','flat'));

-- 3) Allow the new 'flat_tier_fee' charge type (per-shop-per-month, like plan_a_dashboard;
--    reuses the existing uq_ad_billing_charge_shop partial index — no new index needed).
ALTER TABLE ad_billing_charges DROP CONSTRAINT IF EXISTS ad_billing_charges_charge_type_check;
ALTER TABLE ad_billing_charges
  ADD CONSTRAINT ad_billing_charges_charge_type_check CHECK (charge_type IN
    ('plan_a_dashboard','plan_b_margin','plan_c_booking','plan_c_revenue_share','flat_tier_fee'));

-- 4) Shops now request a flat TIER (starter/growth/business) when opting in, not a/b/c.
--    Widen the CHECK (tolerate any legacy a/b/c rows) and default to growth.
ALTER TABLE ad_enrollment_requests DROP CONSTRAINT IF EXISTS ad_enrollment_requests_requested_plan_check;
ALTER TABLE ad_enrollment_requests
  ADD CONSTRAINT ad_enrollment_requests_requested_plan_check
  CHECK (requested_plan IN ('a','b','c','starter','growth','business'));
ALTER TABLE ad_enrollment_requests ALTER COLUMN requested_plan SET DEFAULT 'growth';
