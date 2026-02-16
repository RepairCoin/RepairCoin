-- Migration: Add Manual Booking Support
-- Date: 2026-02-16
-- Description: Adds fields to support manual appointment booking by shops

-- ============================================
-- 1. Add columns to service_orders table
-- ============================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS booked_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid';

-- Add check constraint for booking_type
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS chk_booking_type;
ALTER TABLE service_orders
  ADD CONSTRAINT chk_booking_type
  CHECK (booking_type IN ('online', 'manual'));

-- Add check constraint for payment_status
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE service_orders
  ADD CONSTRAINT chk_payment_status
  CHECK (payment_status IN ('paid', 'pending', 'unpaid'));

-- Add index for booking type queries
CREATE INDEX IF NOT EXISTS idx_service_orders_booking_type ON service_orders(booking_type);
CREATE INDEX IF NOT EXISTS idx_service_orders_payment_status ON service_orders(payment_status);

-- Add comments
COMMENT ON COLUMN service_orders.booking_type IS 'Source of booking: online (customer via marketplace) or manual (shop admin created)';
COMMENT ON COLUMN service_orders.booked_by IS 'Wallet address of shop admin who created manual booking (NULL for online bookings)';
COMMENT ON COLUMN service_orders.payment_status IS 'Payment status for manual bookings: paid (collected in person), pending (will pay later), unpaid (not yet collected)';

-- ============================================
-- 2. Update existing orders to have booking_type = 'online'
-- ============================================
UPDATE service_orders
SET booking_type = 'online'
WHERE booking_type IS NULL;

-- ============================================
-- Migration Complete
-- ============================================
