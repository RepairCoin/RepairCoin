-- Ads System — lifecycle Phase 1: bill-at-first-live (§9.2).
--
-- The ads tier fee should begin only when the shop has a LIVE campaign, never for an
-- idle subscription. (The accrual already only runs for shops with an active campaign,
-- since BillingPlanRepository.listActiveShopPlans is scoped to status='active'.) This
-- column records WHEN billing first began (first live campaign) — used for the shop
-- dashboard ("billing since …") and future proration.

ALTER TABLE ad_billing_plans
  ADD COLUMN IF NOT EXISTS billing_started_at TIMESTAMPTZ;
