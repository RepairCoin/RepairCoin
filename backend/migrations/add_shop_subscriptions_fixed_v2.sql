-- Migration: Update from commitment_enrollments to shop_subscriptions
-- Date: 2025-09-12
-- Description: Convert 6-month commitment program to monthly subscription model

-- Create new shop_subscriptions table
CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'cancelled', 'paused', 'defaulted')),
  monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  subscription_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  billing_method VARCHAR(20) CHECK (billing_method IN ('credit_card', 'ach', 'wire', 'crypto')),
  billing_reference VARCHAR(255),
  payments_made INTEGER NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  next_payment_date TIMESTAMP,
  last_payment_date TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  cancellation_reason TEXT,
  pause_reason TEXT,
  notes TEXT,
  created_by VARCHAR(42)
);

-- Add missing columns to existing table (if table already exists)
ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS billing_method VARCHAR(20) CHECK (billing_method IN ('credit_card', 'ach', 'wire', 'crypto')),
  ADD COLUMN IF NOT EXISTS billing_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payments_made INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(42);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON shop_subscriptions (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status ON shop_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_active ON shop_subscriptions (is_active);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_next_payment ON shop_subscriptions (next_payment_date);

-- Check if commitment_enrollments table exists before migration
DO $migration$
DECLARE
  has_commitment_table BOOLEAN;
  has_subscription_data BOOLEAN;
BEGIN
  -- Check if commitment_enrollments table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'commitment_enrollments'
  ) INTO has_commitment_table;

  -- Check if shop_subscriptions has data
  SELECT EXISTS (
    SELECT 1 FROM shop_subscriptions LIMIT 1
  ) INTO has_subscription_data;

  -- Only migrate if commitment_enrollments exists AND shop_subscriptions is empty
  IF has_commitment_table AND NOT has_subscription_data THEN
    RAISE NOTICE 'Migrating data from commitment_enrollments to shop_subscriptions...';

    -- Use dynamic SQL to avoid parsing errors if columns don't exist
    EXECUTE '
      INSERT INTO shop_subscriptions (
        shop_id,
        status,
        monthly_amount,
        subscription_type,
        billing_method,
        billing_reference,
        payments_made,
        total_paid,
        next_payment_date,
        last_payment_date,
        is_active,
        enrolled_at,
        activated_at,
        cancelled_at,
        cancellation_reason,
        notes,
        created_by
      )
      SELECT
        shop_id,
        CASE
          WHEN status = ''active'' THEN ''active''
          WHEN status = ''pending'' THEN ''pending''
          WHEN status = ''cancelled'' THEN ''cancelled''
          WHEN status = ''completed'' THEN ''cancelled''
          WHEN status = ''defaulted'' THEN ''defaulted''
          ELSE status
        END as status,
        COALESCE(monthly_amount, 500.00),
        ''standard'' as subscription_type,
        billing_method,
        billing_reference,
        COALESCE(payments_made, 0),
        COALESCE(total_paid, 0),
        next_payment_date,
        last_payment_date,
        CASE
          WHEN status IN (''active'', ''pending'') THEN true
          ELSE false
        END as is_active,
        COALESCE(enrolled_at, CURRENT_TIMESTAMP),
        activated_at,
        COALESCE(cancelled_at, completed_at) as cancelled_at,
        COALESCE(cancellation_reason, CASE WHEN status = ''completed'' THEN ''Migration: 6-month term completed'' ELSE NULL END) as cancellation_reason,
        notes,
        created_by
      FROM commitment_enrollments
      WHERE NOT EXISTS (
        SELECT 1 FROM shop_subscriptions ss WHERE ss.shop_id = commitment_enrollments.shop_id
      )';

    RAISE NOTICE 'Migration completed.';
  ELSE
    IF NOT has_commitment_table THEN
      RAISE NOTICE 'Skipping migration: commitment_enrollments table does not exist.';
    ELSIF has_subscription_data THEN
      RAISE NOTICE 'Skipping migration: shop_subscriptions already has data.';
    END IF;
  END IF;
END $migration$;

-- Update shops table to use subscription terminology
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES shop_subscriptions(id);

-- Update subscription_active based on active subscriptions
UPDATE shops s
SET subscription_active = true,
    subscription_id = sub.id
FROM shop_subscriptions sub
WHERE s.shop_id = sub.shop_id
  AND sub.status = 'active'
  AND sub.is_active = true;

-- Create trigger to update shop operational status when subscription changes
CREATE OR REPLACE FUNCTION update_shop_operational_status_on_subscription()
RETURNS TRIGGER AS $func$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update shop's subscription status
    UPDATE shops
    SET
      subscription_active = (NEW.status = 'active' AND NEW.is_active = true),
      subscription_id = CASE
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN NEW.id
        ELSE NULL
      END,
      operational_status = CASE
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'commitment_qualified'
        WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
        ELSE 'not_qualified'
      END
    WHERE shop_id = NEW.shop_id;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Drop trigger if it exists before creating
DROP TRIGGER IF EXISTS trigger_update_shop_on_subscription_change ON shop_subscriptions;

CREATE TRIGGER trigger_update_shop_on_subscription_change
AFTER INSERT OR UPDATE ON shop_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_shop_operational_status_on_subscription();

-- Add comments for documentation
COMMENT ON TABLE shop_subscriptions IS 'Monthly subscription program for shops without RCG tokens';
COMMENT ON COLUMN shop_subscriptions.subscription_type IS 'Type of subscription: standard ($500/mo), premium, or custom';
COMMENT ON COLUMN shop_subscriptions.is_active IS 'Whether subscription is currently active regardless of status';
COMMENT ON COLUMN shop_subscriptions.pause_reason IS 'Reason for pausing subscription (requires admin approval)';

-- Create view for active subscriptions
CREATE OR REPLACE VIEW active_shop_subscriptions AS
SELECT
  s.*,
  sh.name as shop_name,
  sh.wallet_address as shop_wallet,
  sh.email as shop_email
FROM shop_subscriptions s
JOIN shops sh ON s.shop_id = sh.shop_id
WHERE s.status = 'active'
  AND s.is_active = true;

-- Create view for subscription payment tracking
CREATE OR REPLACE VIEW subscription_payment_status AS
SELECT
  s.id,
  s.shop_id,
  sh.name as shop_name,
  s.monthly_amount,
  s.next_payment_date,
  s.last_payment_date,
  s.payments_made,
  s.total_paid,
  CASE
    WHEN s.next_payment_date < CURRENT_DATE THEN 'overdue'
    WHEN s.next_payment_date < CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'current'
  END as payment_status,
  CASE
    WHEN s.next_payment_date < CURRENT_DATE THEN
      EXTRACT(DAY FROM CURRENT_DATE - s.next_payment_date)::INTEGER
    ELSE 0
  END as days_overdue
FROM shop_subscriptions s
JOIN shops sh ON s.shop_id = sh.shop_id
WHERE s.status = 'active'
  AND s.is_active = true
ORDER BY s.next_payment_date ASC;

-- Note: The commitment_enrollments table is preserved for historical data
-- It can be dropped later with: DROP TABLE commitment_enrollments CASCADE;
