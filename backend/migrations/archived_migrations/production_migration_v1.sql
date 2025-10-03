-- ============================================
-- RepairCoin Production Migration v1.0
-- Date: October 2025
-- Description: Consolidated migration for production deployment
-- ============================================

-- IMPORTANT: This migration assumes a fresh database
-- For existing databases, review each section carefully

-- ============================================
-- Step 1: Base Schema Setup
-- ============================================

-- First, run the complete generated schema
-- This is in: generated/complete-schema-2025-09-19.sql
-- It creates all base tables with proper structure

-- ============================================
-- Step 2: Critical Updates and Fixes
-- ============================================

-- Update stripe_customers table
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_stripe_customers_email 
ON stripe_customers(email);

-- Update stripe_subscriptions table
ALTER TABLE stripe_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Update default admin
UPDATE admins 
SET name = 'Admin', 
    is_super_admin = TRUE,
    permissions = '{"all"}'
WHERE name IS NULL;

-- ============================================
-- Step 3: Shop Subscriptions (Replaces Commitments)
-- ============================================

-- Create shop_subscriptions table
CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'cancelled', 'paused', 'defaulted')),
  monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  subscription_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  billing_method VARCHAR(20) CHECK (billing_method IN ('credit_card', 'ach', 'wire', 'crypto')),
  billing_reference VARCHAR(255),
  payments_made INTEGER NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  next_payment_date TIMESTAMP,
  last_payment_date TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  cancellation_reason TEXT,
  pause_reason TEXT,
  notes TEXT,
  created_by VARCHAR(42)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON shop_subscriptions (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status ON shop_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_active ON shop_subscriptions (is_active);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_next_payment ON shop_subscriptions (next_payment_date);

-- Update shops table for subscriptions
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES shop_subscriptions(id);

-- Create trigger for shop operational status
CREATE OR REPLACE FUNCTION update_shop_operational_status_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE shops 
    SET 
      subscription_active = (NEW.status = 'active' AND NEW.is_active = true),
      subscription_id = CASE 
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN NEW.id 
        ELSE NULL 
      END,
      operational_status = CASE
        WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'commitment_qualified'
        WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
        ELSE 'not_qualified'
      END
    WHERE shop_id = NEW.shop_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shop_on_subscription_change
AFTER INSERT OR UPDATE ON shop_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_shop_operational_status_on_subscription();

-- ============================================
-- Step 4: Redemption Sessions
-- ============================================

-- Create redemption_sessions table (drop if exists to ensure clean state)
DROP TABLE IF EXISTS redemption_sessions CASCADE;

CREATE TABLE redemption_sessions (
  session_id VARCHAR(255) NOT NULL PRIMARY KEY,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  max_amount NUMERIC(20,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  qr_code TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX idx_redemption_sessions_customer ON redemption_sessions (customer_address);
CREATE INDEX idx_redemption_sessions_shop ON redemption_sessions (shop_id);
CREATE INDEX idx_redemption_sessions_status ON redemption_sessions (status);
CREATE INDEX idx_redemption_sessions_expires ON redemption_sessions (expires_at);
CREATE INDEX idx_redemption_sessions_active ON redemption_sessions (customer_address, status) 
WHERE status IN ('pending', 'approved');

-- ============================================
-- Step 5: Additional Features
-- ============================================

-- Add ETH payment method to shops
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS eth_payment_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS accept_eth_payments BOOLEAN DEFAULT FALSE;

-- Add minting tracking to purchases
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS mint_transaction_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS minted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mint_status VARCHAR(20) DEFAULT 'pending';

-- Create shop deposits table
CREATE TABLE IF NOT EXISTS shop_deposits (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  deposit_type VARCHAR(20) NOT NULL DEFAULT 'rcn_purchase',
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  reference_number VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shop_deposits_shop_id ON shop_deposits(shop_id);
CREATE INDEX idx_shop_deposits_status ON shop_deposits(status);

-- ============================================
-- Step 6: Views
-- ============================================

-- Active subscriptions view
CREATE OR REPLACE VIEW active_shop_subscriptions AS
SELECT 
  s.*,
  sh.name as shop_name,
  sh.wallet_address as shop_wallet,
  sh.email as shop_email
FROM shop_subscriptions s
JOIN shops sh ON s.shop_id = sh.shop_id
WHERE s.status = 'active' 
  AND s.is_active = true;

-- Subscription payment status view
CREATE OR REPLACE VIEW subscription_payment_status AS
SELECT 
  s.id,
  s.shop_id,
  sh.name as shop_name,
  s.monthly_amount,
  s.next_payment_date,
  s.last_payment_date,
  s.payments_made,
  s.total_paid,
  CASE 
    WHEN s.next_payment_date < CURRENT_DATE THEN 'overdue'
    WHEN s.next_payment_date < CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'current'
  END as payment_status,
  CASE 
    WHEN s.next_payment_date < CURRENT_DATE THEN 
      EXTRACT(DAY FROM CURRENT_DATE - s.next_payment_date)::INTEGER
    ELSE 0
  END as days_overdue
FROM shop_subscriptions s
JOIN shops sh ON s.shop_id = sh.shop_id
WHERE s.status = 'active' 
  AND s.is_active = true
ORDER BY s.next_payment_date ASC;

-- ============================================
-- Step 7: Data Population
-- ============================================

-- Populate customer RCN sources if needed
-- This should be run after initial data import

-- Fix lifetime earnings calculation
-- Run this after importing transaction data to ensure accuracy

-- ============================================
-- Migration Complete
-- ============================================

-- Comments for documentation
COMMENT ON TABLE shop_subscriptions IS 'Monthly subscription program for shops without RCG tokens';
COMMENT ON TABLE redemption_sessions IS 'QR code-based redemption sessions for customers';
COMMENT ON TABLE shop_deposits IS 'Track shop deposits and payments';

-- ============================================
-- Post-Migration Checklist:
-- 1. Verify all tables created successfully
-- 2. Check indexes are properly created
-- 3. Ensure foreign key constraints are valid
-- 4. Run application health checks
-- 5. Monitor for any errors in logs
-- ============================================