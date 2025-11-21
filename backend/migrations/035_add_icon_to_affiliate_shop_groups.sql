-- Migration: Add icon field to affiliate_shop_groups
-- Date: 2025-11-17
-- Description: Adds an optional icon field to affiliate shop groups to make them more visually distinctive

-- Add icon column with default shop emoji
ALTER TABLE affiliate_shop_groups
ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🏪';

-- Add comment to column
COMMENT ON COLUMN affiliate_shop_groups.icon IS 'Emoji icon for visual identification of the group (max 10 chars, defaults to shop emoji 🏪)';
