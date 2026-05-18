-- Migration 115: Add Inventory Email Digest Preferences
-- Date: 2026-05-18
-- Purpose: Allow shops to configure email digest frequency for low stock alerts

-- Add digest preferences to shops table
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS low_stock_digest_mode VARCHAR(20) DEFAULT 'daily'
    CHECK (low_stock_digest_mode IN ('immediate', 'daily', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS low_stock_digest_day_of_week INTEGER DEFAULT 1
    CHECK (low_stock_digest_day_of_week BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS low_stock_digest_day_of_month INTEGER DEFAULT 1
    CHECK (low_stock_digest_day_of_month BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS low_stock_digest_time VARCHAR(5) DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN shops.low_stock_digest_mode IS 'Frequency of low stock digest emails: immediate (current 24h cooldown), daily, weekly, or monthly';
COMMENT ON COLUMN shops.low_stock_digest_day_of_week IS 'Day of week for weekly digests (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN shops.low_stock_digest_day_of_month IS 'Day of month for monthly digests (1-28, safe for all months)';
COMMENT ON COLUMN shops.low_stock_digest_time IS 'Time to send digest in HH:MM format (24-hour, shop timezone)';
COMMENT ON COLUMN shops.last_digest_sent_at IS 'Timestamp of last digest email sent to this shop';

-- Create index for efficient scheduler queries
CREATE INDEX IF NOT EXISTS idx_shops_digest_schedule ON shops(low_stock_digest_mode, last_digest_sent_at)
  WHERE low_stock_alerts_enabled = true;

-- Migration tracking
INSERT INTO migrations (name, applied_at)
VALUES ('115_add_inventory_digest_preferences.sql', NOW());
