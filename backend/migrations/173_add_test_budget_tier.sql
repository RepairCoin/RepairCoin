-- 173 — Safeguard 4 (test-budget tier). A campaign can start at a lower "test" daily budget;
-- after a window of positive ROI it's flagged ready to scale to the full budget (admin confirms).
--   is_test_budget            = running at the reduced test budget
--   full_daily_budget_cents   = the target full daily budget to scale up to
--   test_budget_started_at    = stamped at go-live (window start)
--   test_budget_upgrade_ready = nightly flag: window passed + ROI >= threshold → nudge admin to scale

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS is_test_budget BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_daily_budget_cents INTEGER,
  ADD COLUMN IF NOT EXISTS test_budget_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_budget_upgrade_ready BOOLEAN NOT NULL DEFAULT false;
