-- Migration: Add no_show to service_orders status check constraint
-- This allows orders to be marked as no-show when customers don't arrive

-- Drop the existing check constraint
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

-- Add the new check constraint with no_show included
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'refunded', 'no_show'));
