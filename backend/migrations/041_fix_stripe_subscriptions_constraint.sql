-- Migration: Fix stripe_subscriptions unique constraint
-- Date: 2025-11-28
-- Description: Remove the problematic (shop_id, status) unique constraint that prevents
--              shops from having multiple subscriptions with the same status over time.
--              A shop should be able to have historical subscriptions (e.g., cancel one,
--              create a new one - both could end up as 'canceled' status).

-- Drop the problematic unique constraint
ALTER TABLE stripe_subscriptions
DROP CONSTRAINT IF EXISTS stripe_subscriptions_shop_id_status_key;

-- Verify the constraint was dropped
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stripe_subscriptions_shop_id_status_key'
    ) THEN
        RAISE EXCEPTION 'Failed to drop constraint stripe_subscriptions_shop_id_status_key';
    ELSE
        RAISE NOTICE 'Successfully dropped constraint stripe_subscriptions_shop_id_status_key';
    END IF;
END $$;
