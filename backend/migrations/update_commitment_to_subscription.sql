-- Update commitment_enrollments to support subscription model
-- Remove 6-month term requirement, make it ongoing subscription

-- Rename table to better reflect subscription model
ALTER TABLE commitment_enrollments RENAME TO shop_subscriptions;

-- Update columns to remove term-based fields
ALTER TABLE shop_subscriptions 
  DROP COLUMN IF EXISTS term_months,
  DROP COLUMN IF EXISTS total_commitment,
  ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'standard' CHECK (subscription_type IN ('standard', 'premium', 'custom')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP;

-- Rename completed status to cancelled since there's no "completion" anymore
UPDATE shop_subscriptions 
SET status = 'cancelled' 
WHERE status = 'completed';

-- Update status check constraint
ALTER TABLE shop_subscriptions 
DROP CONSTRAINT IF EXISTS commitment_enrollments_status_check;

ALTER TABLE shop_subscriptions 
ADD CONSTRAINT shop_subscriptions_status_check 
CHECK (status IN ('pending', 'active', 'cancelled', 'paused', 'defaulted'));

-- Add index for active subscriptions
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_active 
ON shop_subscriptions(shop_id, is_active) 
WHERE is_active = true;

-- Update trigger function name
DROP TRIGGER IF EXISTS update_shop_operational_status_trigger ON commitment_enrollments;
DROP FUNCTION IF EXISTS update_shop_operational_status();

-- Create new function for subscription-based operational status
CREATE OR REPLACE FUNCTION update_shop_operational_status_subscription()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shops 
  SET commitment_enrolled = CASE 
    WHEN NEW.status = 'active' AND NEW.is_active = true THEN true
    ELSE false
  END,
  operational_status = CASE
    WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'commitment_qualified'
    WHEN (SELECT rcg_balance FROM shops WHERE shop_id = NEW.shop_id) >= 10000 THEN 'rcg_qualified'
    ELSE 'not_qualified'
  END
  WHERE shop_id = NEW.shop_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription status changes
CREATE TRIGGER update_shop_operational_status_subscription_trigger
AFTER INSERT OR UPDATE ON shop_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_shop_operational_status_subscription();

-- Add comment explaining the new model
COMMENT ON TABLE shop_subscriptions IS 'Monthly subscription program for shops without RCG holdings. No fixed term - continues until cancelled.';
COMMENT ON COLUMN shop_subscriptions.monthly_amount IS 'Monthly subscription fee (default $500)';
COMMENT ON COLUMN shop_subscriptions.subscription_type IS 'Type of subscription: standard ($500), premium (custom pricing), custom';
COMMENT ON COLUMN shop_subscriptions.is_active IS 'Whether subscription is currently active';
COMMENT ON COLUMN shop_subscriptions.paused_at IS 'When subscription was paused (if applicable)';
COMMENT ON COLUMN shop_subscriptions.resumed_at IS 'When subscription was resumed after pause';