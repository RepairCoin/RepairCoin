-- Migration: Add 'expired' status for appointments that pass 24h without being marked complete
-- This status is distinct from no_show (customer didn't arrive) vs expired (shop failed to mark completion)

-- Drop the existing check constraint
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

-- Add the new check constraint with 'expired' included
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'refunded', 'no_show', 'expired'));

-- Add tracking columns for expired orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS expired_by VARCHAR(255);

-- Index for queries filtering by expired status
CREATE INDEX IF NOT EXISTS idx_service_orders_expired ON service_orders(status) WHERE status = 'expired';
