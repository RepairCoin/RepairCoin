-- Migration: Add missing columns to existing tables
-- Date: 2025-09-23
-- Description: Adds columns that are missing from staging database

-- Add missing columns to shop_rcn_purchases table
DO $$ 
BEGIN
    -- Add price_per_rcn column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shop_rcn_purchases' AND column_name='price_per_rcn') THEN
        ALTER TABLE shop_rcn_purchases ADD COLUMN price_per_rcn DECIMAL(10, 4) NOT NULL DEFAULT 0.10;
    END IF;
    
    -- Add completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shop_rcn_purchases' AND column_name='completed_at') THEN
        ALTER TABLE shop_rcn_purchases ADD COLUMN completed_at TIMESTAMP;
    END IF;
    
    -- Add notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shop_rcn_purchases' AND column_name='notes') THEN
        ALTER TABLE shop_rcn_purchases ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Update any existing records that have 0 price_per_rcn to use default price
UPDATE shop_rcn_purchases 
SET price_per_rcn = 0.10 
WHERE price_per_rcn = 0 OR price_per_rcn IS NULL;