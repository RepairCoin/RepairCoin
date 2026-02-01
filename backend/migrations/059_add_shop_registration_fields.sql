-- Migration: Add shop registration fields to shops table
-- Date: January 28, 2026
-- Purpose: Add first_name, last_name, company_size, monthly_revenue, website, referral, accept_terms, country
-- These fields are collected during shop registration but were never added to the database

-- Add personal information columns
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Add business information columns
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS monthly_revenue VARCHAR(50),
ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add referral and terms columns
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS referral VARCHAR(255),
ADD COLUMN IF NOT EXISTS accept_terms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add comments to describe the columns
COMMENT ON COLUMN shops.first_name IS 'Shop owner first name';
COMMENT ON COLUMN shops.last_name IS 'Shop owner last name';
COMMENT ON COLUMN shops.company_size IS 'Number of employees (e.g., 1-5, 6-20, 21-50, 51+)';
COMMENT ON COLUMN shops.monthly_revenue IS 'Monthly revenue range (e.g., <$5K, $5K-$25K, $25K-$100K, $100K+)';
COMMENT ON COLUMN shops.website IS 'Shop website URL';
COMMENT ON COLUMN shops.referral IS 'How the shop heard about RepairCoin';
COMMENT ON COLUMN shops.accept_terms IS 'Whether shop accepted terms and conditions';
COMMENT ON COLUMN shops.country IS 'Shop country location';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Shop registration fields added to shops table successfully';
    RAISE NOTICE 'Added columns: first_name, last_name, company_size, monthly_revenue, website, referral, accept_terms, country';
END $$;
