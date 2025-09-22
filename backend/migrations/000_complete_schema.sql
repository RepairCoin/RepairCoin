-- ============================================
-- RepairCoin Complete Database Schema
-- Use this for fresh production deployments
-- Generated: September 22, 2025
-- ============================================

-- Step 1: Use the complete schema from complete-schema-2025-09-19.sql
-- This creates all base tables, indexes, and constraints

-- Step 2: Apply these critical updates that were added after the schema generation:

-- From add_stripe_email_column.sql (needed for production)
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_stripe_customers_email 
ON stripe_customers(email);

-- Critical updates for stripe_subscriptions
ALTER TABLE stripe_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Critical updates for admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Update default admin to have proper fields
UPDATE admins 
SET name = 'Admin', 
    is_super_admin = TRUE,
    permissions = '{"all"}'
WHERE name IS NULL;

-- ============================================
-- IMPORTANT NOTES FOR PRODUCTION:
-- 1. Run the complete-schema-2025-09-19.sql first
-- 2. Then run this file for the updates
-- 3. Verify all tables exist before starting the app
-- ============================================