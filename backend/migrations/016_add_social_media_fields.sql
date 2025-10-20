-- Migration: Add social media fields to shops table
-- Date: October 15, 2025
-- Purpose: Add Facebook, Twitter, and Instagram URL fields to the shops table

-- Add social media columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS facebook VARCHAR(255),
ADD COLUMN IF NOT EXISTS twitter VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);

-- Add comments to describe the columns
COMMENT ON COLUMN shops.facebook IS 'Facebook page URL for the shop';
COMMENT ON COLUMN shops.twitter IS 'Twitter profile URL for the shop';
COMMENT ON COLUMN shops.instagram IS 'Instagram profile URL for the shop';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Social media fields added to shops table successfully';
    RAISE NOTICE 'Added columns: facebook, twitter, instagram';
END $$;