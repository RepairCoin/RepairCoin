-- Migration 004: Remove Obsolete Columns
-- Created: 2025-10-28
-- Purpose: Remove obsolete columns after implementing universal redemption and removing earning limits

-- ============================================================================
-- 1. REMOVE CROSS-SHOP ENABLED COLUMN
-- ============================================================================

-- Remove cross_shop_enabled from shops table (no longer needed - universal redemption)
ALTER TABLE shops
DROP COLUMN IF EXISTS cross_shop_enabled;

-- Add comment to document the changes
COMMENT ON TABLE shops IS 'Shops table - all shops now support universal redemption (100% of earned RCN)';

-- ============================================================================
-- 2. REMOVE EARNING LIMIT COLUMNS
-- ============================================================================

-- Remove daily and monthly earning limit columns from customers table
ALTER TABLE customers
DROP COLUMN IF EXISTS daily_earnings CASCADE,
DROP COLUMN IF EXISTS monthly_earnings CASCADE;

-- Add comment to document the changes
COMMENT ON TABLE customers IS 'Customers table - earning limits removed, only lifetime_earnings tracked';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If rollback is needed, run:
-- ALTER TABLE shops ADD COLUMN cross_shop_enabled BOOL DEFAULT false;
-- ALTER TABLE customers ADD COLUMN daily_earnings NUMERIC(20,8) DEFAULT 0;
-- ALTER TABLE customers ADD COLUMN monthly_earnings NUMERIC(20,8) DEFAULT 0;
