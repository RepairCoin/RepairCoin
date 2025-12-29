-- Migration: Add cancellation fields to service_orders
-- Date: 2025-12-26
-- Description: Adds fields to track cancellation reason, notes, and timestamp

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- Add index for cancelled_at for analytics
CREATE INDEX IF NOT EXISTS idx_service_orders_cancelled_at ON service_orders(cancelled_at);

-- Add comments
COMMENT ON COLUMN service_orders.cancelled_at IS 'Timestamp when the order was cancelled';
COMMENT ON COLUMN service_orders.cancellation_reason IS 'Reason code for cancellation (e.g., schedule_conflict, too_expensive)';
COMMENT ON COLUMN service_orders.cancellation_notes IS 'Additional notes provided by customer during cancellation';
