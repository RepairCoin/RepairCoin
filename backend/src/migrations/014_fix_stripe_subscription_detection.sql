-- Migration: Fix Stripe subscription detection for shop operational status
-- Date: September 17, 2025
-- Purpose: Ensure shops with active Stripe subscriptions are properly detected as commitment_qualified

-- 1. Update the shop operational status trigger to check Stripe subscriptions
CREATE OR REPLACE FUNCTION update_shop_operational_status()
RETURNS TRIGGER AS $$
BEGIN
  -- First check if shop has sufficient RCG balance
  IF NEW.rcg_balance >= 10000 THEN
    NEW.operational_status = 'rcg_qualified';
  -- Then check for active Stripe subscription
  ELSIF EXISTS (
    SELECT 1 FROM stripe_subscriptions 
    WHERE shop_id = NEW.shop_id AND status = 'active'
  ) THEN
    NEW.operational_status = 'commitment_qualified';
    NEW.commitment_enrolled = TRUE;
  -- Legacy: Check old commitment enrollments table (to be removed in future)
  ELSIF EXISTS (
    SELECT 1 FROM commitment_enrollments 
    WHERE shop_id = NEW.shop_id AND status = 'active'
  ) THEN
    NEW.operational_status = 'commitment_qualified';
  ELSE
    NEW.operational_status = 'not_qualified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update the subscription trigger to ensure it works correctly
CREATE OR REPLACE FUNCTION update_shop_operational_status_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shop operational status based on subscription status
    IF NEW.status = 'active' THEN
        -- Active subscription always qualifies as commitment_qualified
        UPDATE shops 
        SET operational_status = 'commitment_qualified',
            commitment_enrolled = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = NEW.shop_id;
        
        RAISE NOTICE 'Shop % set to commitment_qualified due to active subscription', NEW.shop_id;
    
    ELSIF NEW.status IN ('past_due', 'unpaid', 'canceled') THEN
        -- Check if shop has RCG qualification, otherwise set to not_qualified
        UPDATE shops 
        SET operational_status = CASE 
                WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
                ELSE 'not_qualified'
            END,
            commitment_enrolled = FALSE,
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

-- 3. Fix any existing shops with active subscriptions but wrong operational status
UPDATE shops s
SET operational_status = 'commitment_qualified',
    commitment_enrolled = TRUE,
    updated_at = CURRENT_TIMESTAMP
FROM stripe_subscriptions ss
WHERE s.shop_id = ss.shop_id 
  AND ss.status = 'active'
  AND (s.operational_status != 'commitment_qualified' OR s.commitment_enrolled != TRUE);

-- 4. Log the migration results
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE 'Migration complete: Fixed % shops with active Stripe subscriptions', fixed_count;
END $$;