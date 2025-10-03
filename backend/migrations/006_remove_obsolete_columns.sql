-- Migration: Remove obsolete columns after implementing universal redemption and removing earning limits
-- Date: 2025-10-03
-- Description: Remove cross_shop_enabled from shops and daily/monthly earnings tracking from customers

-- Start transaction
BEGIN;

-- Remove cross_shop_enabled from shops table (no longer needed - universal redemption)
ALTER TABLE shops 
DROP COLUMN IF EXISTS cross_shop_enabled;

-- Remove daily and monthly earning limit columns from customers table
ALTER TABLE customers
DROP COLUMN IF EXISTS daily_earnings,
DROP COLUMN IF EXISTS monthly_earnings;

-- Add comment to document the changes
COMMENT ON TABLE shops IS 'Shops table - all shops now support universal redemption (100% of earned RCN)';
COMMENT ON TABLE customers IS 'Customers table - earning limits removed, only lifetime_earnings tracked';

-- Update any views that might reference these columns
-- Note: If you have any views using these columns, they'll need to be recreated

COMMIT;

-- Rollback script (if needed)
-- BEGIN;
-- ALTER TABLE shops ADD COLUMN cross_shop_enabled BOOL DEFAULT false;
-- ALTER TABLE customers ADD COLUMN daily_earnings NUMERIC(20,8) DEFAULT 0;
-- ALTER TABLE customers ADD COLUMN monthly_earnings NUMERIC(20,8) DEFAULT 0;
-- COMMIT;