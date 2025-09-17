-- Migration: Remove commitment enrollment system
-- Date: September 17, 2025
-- Purpose: Remove all commitment-related tables, columns, and functions as the feature is no longer needed

-- 1. Drop commitment-related triggers first
DROP TRIGGER IF EXISTS update_commitment_status_trigger ON commitment_enrollments;

-- 2. Update the shop operational status function to remove commitment checks
CREATE OR REPLACE FUNCTION update_shop_operational_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check RCG balance and Stripe subscriptions
  IF NEW.rcg_balance >= 10000 THEN
    NEW.operational_status = 'rcg_qualified';
  -- Check for active Stripe subscription
  ELSIF EXISTS (
    SELECT 1 FROM stripe_subscriptions 
    WHERE shop_id = NEW.shop_id AND status = 'active'
  ) THEN
    NEW.operational_status = 'subscription_qualified'; -- Changed from commitment_qualified
  ELSE
    NEW.operational_status = 'not_qualified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update the subscription status trigger to use new terminology
CREATE OR REPLACE FUNCTION update_shop_operational_status_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shop operational status based on subscription status
    IF NEW.status = 'active' THEN
        -- Active subscription qualifies for operational status
        UPDATE shops 
        SET operational_status = 'subscription_qualified',
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = NEW.shop_id;
        
        RAISE NOTICE 'Shop % set to subscription_qualified due to active subscription', NEW.shop_id;
    
    ELSIF NEW.status IN ('past_due', 'unpaid', 'canceled') THEN
        -- Check if shop has RCG qualification, otherwise set to not_qualified
        UPDATE shops 
        SET operational_status = CASE 
                WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
                ELSE 'not_qualified'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = NEW.shop_id;
        
        RAISE NOTICE 'Shop % subscription status changed to %', NEW.shop_id, NEW.status;
    -- Don't change operational status for incomplete subscriptions
    ELSIF NEW.status = 'incomplete' THEN
        RAISE NOTICE 'Shop % subscription is incomplete, not changing operational status', NEW.shop_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update shops to use new operational status
UPDATE shops 
SET operational_status = 'subscription_qualified' 
WHERE operational_status = 'commitment_qualified';

-- 5. Drop commitment-related columns from shops table
ALTER TABLE shops DROP COLUMN IF EXISTS commitment_enrolled;
ALTER TABLE shops DROP COLUMN IF EXISTS commitment_path;
ALTER TABLE shops DROP COLUMN IF EXISTS commitment_monthly_amount;

-- 6. Drop commitment_enrollments table
DROP TABLE IF EXISTS commitment_enrollments CASCADE;

-- 7. Update operational_status check constraint to remove commitment_qualified
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_operational_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_operational_status_check 
    CHECK (operational_status IN ('pending', 'rcg_qualified', 'subscription_qualified', 'not_qualified'));

-- 8. Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Commitment enrollment system removed successfully';
    RAISE NOTICE 'Updated % shops from commitment_qualified to subscription_qualified', 
        (SELECT COUNT(*) FROM shops WHERE operational_status = 'subscription_qualified');
END $$;