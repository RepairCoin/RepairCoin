-- Migration 005: Add Social Media Fields
-- Created: 2025-10-28
-- Purpose: Add Facebook, Twitter, and Instagram URL fields to the shops table

-- ============================================================================
-- ADD SOCIAL MEDIA COLUMNS
-- ============================================================================

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS facebook VARCHAR(255),
ADD COLUMN IF NOT EXISTS twitter VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);

-- Add comments to describe the columns
COMMENT ON COLUMN shops.facebook IS 'Facebook page URL for the shop';
COMMENT ON COLUMN shops.twitter IS 'Twitter profile URL for the shop';
COMMENT ON COLUMN shops.instagram IS 'Instagram profile URL for the shop';

-- Add indexes for potential searches
CREATE INDEX IF NOT EXISTS idx_shops_has_facebook ON shops(facebook) WHERE facebook IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_has_twitter ON shops(twitter) WHERE twitter IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_has_instagram ON shops(instagram) WHERE instagram IS NOT NULL;
