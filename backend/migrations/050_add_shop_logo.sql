-- Migration: Add logo_url column to shops table
-- This allows shops to upload and display their logo

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(512);

-- Add comment for documentation
COMMENT ON COLUMN shops.logo_url IS 'URL to shop logo stored in DigitalOcean Spaces';
