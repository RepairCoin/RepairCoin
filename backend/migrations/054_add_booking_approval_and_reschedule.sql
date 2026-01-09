-- Migration: Add booking approval and reschedule tracking
-- Date: 2026-01-02
-- Description: Adds columns for shop approval workflow and reschedule history

-- Add shop approval columns
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS shop_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);

-- Add reschedule tracking columns
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS original_booking_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS original_booking_time_slot VARCHAR(50),
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rescheduled_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_service_orders_shop_approved ON service_orders(shop_approved);
CREATE INDEX IF NOT EXISTS idx_service_orders_approved_at ON service_orders(approved_at);

-- Add comments
COMMENT ON COLUMN service_orders.shop_approved IS 'Whether the shop has approved this booking';
COMMENT ON COLUMN service_orders.approved_at IS 'When the booking was approved by the shop';
COMMENT ON COLUMN service_orders.approved_by IS 'Who approved the booking (shop wallet address)';
COMMENT ON COLUMN service_orders.original_booking_date IS 'Original booking date before any reschedule';
COMMENT ON COLUMN service_orders.original_booking_time_slot IS 'Original time slot before any reschedule';
COMMENT ON COLUMN service_orders.rescheduled_at IS 'When the booking was last rescheduled';
COMMENT ON COLUMN service_orders.rescheduled_by IS 'Who rescheduled: shop or customer';
COMMENT ON COLUMN service_orders.reschedule_reason IS 'Reason for rescheduling';
COMMENT ON COLUMN service_orders.reschedule_count IS 'Number of times this booking has been rescheduled';
