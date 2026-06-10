-- Migration 137: Add shop rejoinder to service reviews
-- Allows the shop to reply back after a customer has counter-replied

ALTER TABLE service_reviews
  ADD COLUMN IF NOT EXISTS shop_rejoinder TEXT,
  ADD COLUMN IF NOT EXISTS shop_rejoinder_at TIMESTAMPTZ;
