-- Migration 003: Stripe and Purchase Improvements
-- Created: 2025-10-28
-- Purpose: Add Stripe customer fields and purchase completion tracking

-- ============================================================================
-- 1. ADD STRIPE CUSTOMER FIELDS
-- ============================================================================

-- Add email column to stripe_customers table
ALTER TABLE stripe_customers
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add name column
ALTER TABLE stripe_customers
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add metadata column for additional data
ALTER TABLE stripe_customers
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email
ON stripe_customers(email);

-- Update existing records with shop email if available
UPDATE stripe_customers sc
SET email = s.email,
    name = s.name
FROM shops s
WHERE sc.shop_id = s.shop_id
AND sc.email IS NULL;

-- ============================================================================
-- 2. ADD PURCHASE COMPLETION TRACKING
-- ============================================================================

-- Add completed_at column to shop_rcn_purchases table
ALTER TABLE shop_rcn_purchases
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Update existing completed purchases to have a completed_at timestamp
UPDATE shop_rcn_purchases
SET completed_at = created_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_completed_at
ON shop_rcn_purchases(completed_at)
WHERE completed_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN shop_rcn_purchases.completed_at IS 'Timestamp when purchase was marked as completed';
