-- Migration: Add no-show tracking to service_orders
-- Date: 2025-12-29
-- Description: Adds fields to track when customers don't show up for appointments

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marked_no_show_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS no_show_notes TEXT;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_service_orders_no_show ON service_orders(no_show, marked_no_show_at);

-- Add comments
COMMENT ON COLUMN service_orders.no_show IS 'True if customer did not show up for appointment';
COMMENT ON COLUMN service_orders.marked_no_show_at IS 'Timestamp when order was marked as no-show by shop';
COMMENT ON COLUMN service_orders.no_show_notes IS 'Optional notes from shop about the no-show';
