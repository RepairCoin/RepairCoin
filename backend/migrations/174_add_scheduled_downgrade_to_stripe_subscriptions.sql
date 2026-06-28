-- Downgrades are scheduled at period end via a Stripe subscription schedule
-- (so the live price never drops mid-cycle and re-upgrading can't double-charge).
-- These columns mirror that pending downgrade so the shop UI can show
-- "Downgrade to <tier> on <date>" without a live Stripe call on every status read.
-- Set when a downgrade is scheduled; cleared when it's cancelled/superseded or
-- once it applies at renewal.

ALTER TABLE stripe_subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_tier TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMPTZ;
