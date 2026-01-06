-- Migration: Add timezone support to shops
-- Date: 2026-01-05
-- Description: Add timezone column to shop_time_slot_config for proper time calculations

-- Add timezone column to shop_time_slot_config
-- Default to America/New_York (Eastern Time) as most shops are US-based
ALTER TABLE shop_time_slot_config
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_shop_time_slot_config_timezone ON shop_time_slot_config(timezone);

-- Comment explaining the timezone field
COMMENT ON COLUMN shop_time_slot_config.timezone IS 'IANA timezone identifier (e.g., America/New_York, America/Los_Angeles, Europe/London). Used for calculating available time slots based on shop local time.';

-- Update existing shops to have a default timezone if null
UPDATE shop_time_slot_config SET timezone = 'America/New_York' WHERE timezone IS NULL;
