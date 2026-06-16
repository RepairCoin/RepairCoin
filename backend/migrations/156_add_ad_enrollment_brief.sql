-- Ads System — campaign brief on the shop's "Request ads" opt-in.
--
-- When a shop requests ads, the admin needs to know WHAT to advertise. These optional
-- fields let the shop tell us up front (which services, budget, offer, area, goal) so
-- the admin builds the right campaign instead of guessing from a free-text note.
-- All nullable/defaulted — the brief is encouraged, not required.

ALTER TABLE ad_enrollment_requests
  ADD COLUMN IF NOT EXISTS promote_service_ids TEXT[] NOT NULL DEFAULT '{}',  -- shop's own service ids to advertise
  ADD COLUMN IF NOT EXISTS monthly_budget_cents INTEGER
    CHECK (monthly_budget_cents IS NULL OR monthly_budget_cents >= 0),
  ADD COLUMN IF NOT EXISTS offer TEXT,                                        -- e.g. "$49 screen repair this month"
  ADD COLUMN IF NOT EXISTS target_radius_miles INTEGER
    CHECK (target_radius_miles IS NULL OR target_radius_miles BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS goal TEXT
    CHECK (goal IS NULL OR goal IN ('more_bookings','awareness','promote_service'));
