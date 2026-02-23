-- Migration: Add No-Show Penalty System
-- Date: 2026-02-09
-- Description: Adds comprehensive no-show tracking and penalty system

-- ============================================
-- 1. Add columns to customers table
-- ============================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_tier VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_no_show_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS booking_suspended_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS successful_appointments_since_tier3 INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_no_show_tier ON customers(no_show_tier);
CREATE INDEX IF NOT EXISTS idx_customers_suspended ON customers(booking_suspended_until)
  WHERE booking_suspended_until IS NOT NULL;

-- Add check constraint for tier values
ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_no_show_tier;
ALTER TABLE customers
  ADD CONSTRAINT chk_no_show_tier
  CHECK (no_show_tier IN ('normal', 'warning', 'caution', 'deposit_required', 'suspended'));

-- Add comments
COMMENT ON COLUMN customers.no_show_count IS 'Total number of no-shows for this customer';
COMMENT ON COLUMN customers.no_show_tier IS 'Current penalty tier: normal, warning, caution, deposit_required, suspended';
COMMENT ON COLUMN customers.deposit_required IS 'True if customer must pay deposit for bookings';
COMMENT ON COLUMN customers.last_no_show_at IS 'Timestamp of most recent no-show';
COMMENT ON COLUMN customers.booking_suspended_until IS 'Suspension end date (NULL if not suspended)';
COMMENT ON COLUMN customers.successful_appointments_since_tier3 IS 'Counter for successful appointments to restore from tier 3';

-- ============================================
-- 2. Create no_show_history table
-- ============================================
CREATE TABLE IF NOT EXISTS no_show_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address VARCHAR(255) NOT NULL,
  order_id UUID NOT NULL,
  service_id UUID NOT NULL,
  shop_id VARCHAR(255) NOT NULL,

  -- Appointment Details
  scheduled_time TIMESTAMP NOT NULL,
  marked_no_show_at TIMESTAMP NOT NULL DEFAULT NOW(),
  marked_by VARCHAR(255), -- shop admin address or 'SYSTEM'

  -- Context
  notes TEXT,
  grace_period_minutes INTEGER DEFAULT 15,
  customer_tier_at_time VARCHAR(20),

  -- Status
  disputed BOOLEAN DEFAULT FALSE,
  dispute_status VARCHAR(20), -- 'pending', 'approved', 'rejected'
  dispute_reason TEXT,
  dispute_submitted_at TIMESTAMP,
  dispute_resolved_at TIMESTAMP,
  dispute_resolved_by VARCHAR(255),
  dispute_resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()

  -- Note: Foreign keys temporarily removed due to column type mismatches
  -- Will be added in a future migration after type alignment
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_no_show_history_customer ON no_show_history(customer_address, marked_no_show_at DESC);
CREATE INDEX IF NOT EXISTS idx_no_show_history_shop ON no_show_history(shop_id, marked_no_show_at DESC);
CREATE INDEX IF NOT EXISTS idx_no_show_history_disputed ON no_show_history(disputed, dispute_status)
  WHERE disputed = TRUE;
CREATE INDEX IF NOT EXISTS idx_no_show_history_order ON no_show_history(order_id);

-- Check constraint for dispute status
ALTER TABLE no_show_history DROP CONSTRAINT IF EXISTS chk_dispute_status;
ALTER TABLE no_show_history
  ADD CONSTRAINT chk_dispute_status
  CHECK (dispute_status IS NULL OR dispute_status IN ('pending', 'approved', 'rejected'));

-- Comments
COMMENT ON TABLE no_show_history IS 'Complete history of all no-show incidents with dispute tracking';
COMMENT ON COLUMN no_show_history.disputed IS 'True if customer has disputed this no-show';
COMMENT ON COLUMN no_show_history.dispute_status IS 'Current status of dispute: pending, approved, rejected';

-- ============================================
-- 3. Create shop_no_show_policy table
-- ============================================
CREATE TABLE IF NOT EXISTS shop_no_show_policy (
  shop_id VARCHAR(255) PRIMARY KEY,

  -- Basic Settings
  enabled BOOLEAN DEFAULT TRUE,
  grace_period_minutes INTEGER DEFAULT 15,
  minimum_cancellation_hours INTEGER DEFAULT 4,
  auto_detection_enabled BOOLEAN DEFAULT FALSE,
  auto_detection_delay_hours INTEGER DEFAULT 2,

  -- Penalty Tiers
  caution_threshold INTEGER DEFAULT 2,
  caution_advance_booking_hours INTEGER DEFAULT 24,
  deposit_threshold INTEGER DEFAULT 3,
  deposit_amount DECIMAL(10,2) DEFAULT 25.00,
  deposit_advance_booking_hours INTEGER DEFAULT 48,
  deposit_reset_after_successful INTEGER DEFAULT 3,
  max_rcn_redemption_percent INTEGER DEFAULT 80,
  suspension_threshold INTEGER DEFAULT 5,
  suspension_duration_days INTEGER DEFAULT 30,

  -- Notifications
  send_email_tier1 BOOLEAN DEFAULT TRUE,
  send_email_tier2 BOOLEAN DEFAULT TRUE,
  send_email_tier3 BOOLEAN DEFAULT TRUE,
  send_email_tier4 BOOLEAN DEFAULT TRUE,
  send_sms_tier2 BOOLEAN DEFAULT FALSE,
  send_sms_tier3 BOOLEAN DEFAULT TRUE,
  send_sms_tier4 BOOLEAN DEFAULT TRUE,
  send_push_notifications BOOLEAN DEFAULT TRUE,

  -- Disputes
  allow_disputes BOOLEAN DEFAULT TRUE,
  dispute_window_days INTEGER DEFAULT 7,
  auto_approve_first_offense BOOLEAN DEFAULT TRUE,
  require_shop_review BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()

  -- Note: Foreign keys temporarily removed due to column type mismatches
);

-- Comments
COMMENT ON TABLE shop_no_show_policy IS 'Shop-specific no-show penalty configuration';
COMMENT ON COLUMN shop_no_show_policy.grace_period_minutes IS 'Minutes late before marking as no-show';
COMMENT ON COLUMN shop_no_show_policy.deposit_amount IS 'Refundable deposit amount in USD for tier 3 customers';

-- ============================================
-- 4. Create deposit_transactions table
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,

  -- Deposit Details
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'held', -- 'held', 'refunded', 'forfeited'

  -- Stripe Details
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_refund_id VARCHAR(255),

  -- Timestamps
  charged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMP,
  forfeited_at TIMESTAMP,

  -- Metadata
  reason TEXT,
  refund_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()

  -- Note: Foreign keys temporarily removed due to column type mismatches
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_customer ON deposit_transactions(customer_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_shop ON deposit_transactions(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_status ON deposit_transactions(status);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_order ON deposit_transactions(order_id);

-- Check constraint for status
ALTER TABLE deposit_transactions DROP CONSTRAINT IF EXISTS chk_deposit_status;
ALTER TABLE deposit_transactions
  ADD CONSTRAINT chk_deposit_status
  CHECK (status IN ('held', 'refunded', 'forfeited'));

-- Comments
COMMENT ON TABLE deposit_transactions IS 'Tracks refundable deposits for customers with 3+ no-shows';
COMMENT ON COLUMN deposit_transactions.status IS 'held = awaiting appointment, refunded = customer showed up, forfeited = customer no-showed again';

-- ============================================
-- 5. Create function to auto-update customer tier
-- ============================================
CREATE OR REPLACE FUNCTION update_customer_no_show_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_policy RECORD;
BEGIN
  -- Get shop's no-show policy (or use defaults if not found)
  SELECT * INTO v_policy
  FROM shop_no_show_policy
  WHERE shop_id = NEW.shop_id;

  -- If no policy exists, use defaults
  IF NOT FOUND THEN
    v_policy.caution_threshold := 2;
    v_policy.deposit_threshold := 3;
    v_policy.suspension_threshold := 5;
    v_policy.suspension_duration_days := 30;
  END IF;

  -- Update customer tier based on no_show_count
  UPDATE customers
  SET
    no_show_tier = CASE
      WHEN no_show_count >= v_policy.suspension_threshold THEN 'suspended'
      WHEN no_show_count >= v_policy.deposit_threshold THEN 'deposit_required'
      WHEN no_show_count >= v_policy.caution_threshold THEN 'caution'
      WHEN no_show_count = 1 THEN 'warning'
      ELSE 'normal'
    END,
    deposit_required = (no_show_count >= v_policy.deposit_threshold),
    booking_suspended_until = CASE
      WHEN no_show_count >= v_policy.suspension_threshold
      THEN NOW() + (v_policy.suspension_duration_days || ' days')::INTERVAL
      ELSE NULL
    END,
    last_no_show_at = NEW.marked_no_show_at
  WHERE wallet_address = NEW.customer_address;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update tier on new no-show
DROP TRIGGER IF EXISTS trg_update_customer_tier ON no_show_history;
CREATE TRIGGER trg_update_customer_tier
  AFTER INSERT ON no_show_history
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_no_show_tier();

-- ============================================
-- 6. Create default policies for existing shops
-- ============================================
INSERT INTO shop_no_show_policy (shop_id)
SELECT shop_id FROM shops
WHERE NOT EXISTS (
  SELECT 1 FROM shop_no_show_policy WHERE shop_no_show_policy.shop_id = shops.shop_id
)
ON CONFLICT (shop_id) DO NOTHING;

-- ============================================
-- Migration Complete
-- ============================================
