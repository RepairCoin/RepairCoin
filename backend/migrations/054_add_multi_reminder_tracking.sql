-- Migration: Add multi-reminder tracking to service_orders
-- Date: 2026-01-02
-- Description: Adds columns for tracking multiple reminder intervals (24h, 2h)
--              while maintaining backward compatibility with existing reminder_sent column

-- =====================================================
-- 1. Add reminder_sent column if it doesn't exist (for backward compatibility)
-- =====================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- =====================================================
-- 2. Add 24-hour reminder tracking
-- =====================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMP;

-- =====================================================
-- 3. Add 2-hour reminder tracking
-- =====================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMP;

-- =====================================================
-- 4. Create index for efficient reminder queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_service_orders_reminder_24h
  ON service_orders(reminder_24h_sent)
  WHERE status IN ('paid', 'confirmed') AND booking_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_reminder_2h
  ON service_orders(reminder_2h_sent)
  WHERE status IN ('paid', 'confirmed') AND booking_date IS NOT NULL;

-- =====================================================
-- 5. Migrate existing reminder_sent data to new columns
--    If reminder_sent is true, mark 24h as sent
-- =====================================================
UPDATE service_orders
SET
  reminder_24h_sent = reminder_sent,
  reminder_24h_sent_at = CASE WHEN reminder_sent = true THEN updated_at ELSE NULL END
WHERE reminder_sent = true;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON COLUMN service_orders.reminder_24h_sent IS '24-hour reminder sent (email + in-app)';
COMMENT ON COLUMN service_orders.reminder_24h_sent_at IS 'Timestamp when 24h reminder was sent';
COMMENT ON COLUMN service_orders.reminder_2h_sent IS '2-hour reminder sent (in-app only)';
COMMENT ON COLUMN service_orders.reminder_2h_sent_at IS 'Timestamp when 2h reminder was sent';
