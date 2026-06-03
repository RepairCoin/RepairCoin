-- 132_add_suspension_columns.sql
--
-- Adds suspension tracking columns to customers and shops tables.
--
-- These columns were previously added manually to some environments without
-- a migration file, causing suspension features (SC-03, SC-12) to fail on
-- environments where the columns do not exist.
--
-- customers.suspended_at   - timestamp when admin suspended the account (NULL = not suspended)
-- customers.suspension_reason - optional reason provided by admin
--
-- shops.suspended_at        - timestamp when admin suspended the shop (NULL = not suspended)
-- shops.suspension_reason   - optional reason provided by admin
--
-- Both columns use IF NOT EXISTS to safely apply on environments where
-- the columns were already added manually.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
