-- Complete RepairCoin Database Schema
-- This file combines all migrations into one comprehensive schema
-- Run this on a fresh database to set up everything at once

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    address VARCHAR(42) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    wallet_address VARCHAR(42) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    lifetime_earnings NUMERIC(20, 8) DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD')),
    daily_earnings NUMERIC(20, 8) DEFAULT 0,
    monthly_earnings NUMERIC(20, 8) DEFAULT 0,
    last_earned_date DATE DEFAULT CURRENT_DATE,
    referral_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Referral system columns
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(42) REFERENCES customers(address),
    home_shop_id VARCHAR(50),
    -- Suspension system
    is_suspended BOOLEAN DEFAULT false,
    suspension_reason TEXT,
    suspended_at TIMESTAMP,
    suspended_by VARCHAR(255)
);

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    shop_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    wallet_address VARCHAR(42) NOT NULL,
    reimbursement_address VARCHAR(42),
    verified BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    cross_shop_enabled BOOLEAN DEFAULT false,
    total_tokens_issued NUMERIC(20, 8) DEFAULT 0,
    total_redemptions NUMERIC(20, 8) DEFAULT 0,
    total_reimbursements NUMERIC(20, 8) DEFAULT 0,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fixflow_shop_id VARCHAR(100),
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_zip_code VARCHAR(20),
    -- Shop purchasing model
    purchased_rcn_balance NUMERIC(20, 8) DEFAULT 0,
    total_rcn_purchased NUMERIC(20, 8) DEFAULT 0,
    last_purchase_date TIMESTAMP,
    -- Suspension fields
    is_suspended BOOLEAN DEFAULT false,
    suspension_reason TEXT,
    suspended_at TIMESTAMP,
    suspended_by VARCHAR(255),
    -- Business information
    company_size VARCHAR(50),
    monthly_revenue VARCHAR(50),
    owner_name VARCHAR(255),
    referral_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update foreign key after shops table is created
ALTER TABLE customers 
ADD CONSTRAINT fk_home_shop 
FOREIGN KEY (home_shop_id) 
REFERENCES shops(shop_id);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100),
    type VARCHAR(20) NOT NULL CHECK (type IN ('mint', 'redeem', 'tier_bonus')),
    amount NUMERIC(20, 8) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    transaction_hash VARCHAR(66) UNIQUE,
    repair_order_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    source_classification VARCHAR(20) DEFAULT 'earned' -- 'earned' or 'market'
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    source VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Shop RCN purchases table
CREATE TABLE IF NOT EXISTS shop_rcn_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id VARCHAR(100) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL,
    price_per_rcn NUMERIC(10, 4) DEFAULT 1.0000,
    total_cost NUMERIC(20, 8) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('credit_card', 'bank_transfer', 'usdc')),
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- =====================================================
-- REFERRAL SYSTEM TABLES
-- =====================================================

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referrer_address VARCHAR(42) NOT NULL REFERENCES customers(address),
    referee_address VARCHAR(42) REFERENCES customers(address),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    reward_transaction_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Customer RCN sources table
CREATE TABLE IF NOT EXISTS customer_rcn_sources (
    id SERIAL PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL REFERENCES customers(address),
    source_type VARCHAR(50) NOT NULL, -- 'shop_repair', 'referral_bonus', 'tier_bonus', 'promotion', 'market_purchase'
    source_shop_id VARCHAR(50) REFERENCES shops(shop_id),
    amount NUMERIC(20, 8) NOT NULL,
    transaction_id VARCHAR(100),
    transaction_hash VARCHAR(66),
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_redeemable BOOLEAN DEFAULT true, -- false for market purchases
    metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- REDEMPTION SYSTEM TABLES
-- =====================================================

-- Redemption sessions table
CREATE TABLE IF NOT EXISTS redemption_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    customer_address VARCHAR(42) NOT NULL REFERENCES customers(address),
    shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
    amount NUMERIC(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'completed')),
    approval_method VARCHAR(20) CHECK (approval_method IN ('qr_code', 'manual')),
    qr_code TEXT,
    qr_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    rejection_reason TEXT
);

-- =====================================================
-- VERIFICATION & TRACKING TABLES
-- =====================================================

-- Token sources table
CREATE TABLE IF NOT EXISTS token_sources (
    id SERIAL PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100),
    source VARCHAR(50) NOT NULL, -- 'repair', 'referral', 'bonus', 'market'
    amount NUMERIC(20, 8) NOT NULL,
    transaction_hash VARCHAR(66),
    is_redeemable_at_shops BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_address) REFERENCES customers(wallet_address) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL
);

-- Cross-shop verifications table
CREATE TABLE IF NOT EXISTS cross_shop_verifications (
    id SERIAL PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL,
    home_shop_id VARCHAR(100) NOT NULL,
    requesting_shop_id VARCHAR(100) NOT NULL,
    requested_amount NUMERIC(20, 8) NOT NULL,
    tier_at_time VARCHAR(20) NOT NULL,
    daily_cross_shop_amount NUMERIC(20, 8) NOT NULL,
    is_allowed BOOLEAN NOT NULL,
    denial_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_address) REFERENCES customers(wallet_address) ON DELETE CASCADE,
    FOREIGN KEY (home_shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
    FOREIGN KEY (requesting_shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- Tier bonuses table
CREATE TABLE IF NOT EXISTS tier_bonuses (
    id SERIAL PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    bonus_amount NUMERIC(20, 8) NOT NULL,
    base_amount NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_address) REFERENCES customers(wallet_address) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- =====================================================
-- ADMIN & SYSTEM TABLES
-- =====================================================

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_address VARCHAR(42) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'customer', 'shop', 'transaction', etc.
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin treasury table
CREATE TABLE IF NOT EXISTS admin_treasury (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures only one row
    total_supply NUMERIC(20, 8) DEFAULT 0,
    available_supply NUMERIC(20, 8) DEFAULT 0,
    total_sold NUMERIC(20, 8) DEFAULT 0,
    total_revenue NUMERIC(20, 8) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unsuspend requests table
CREATE TABLE IF NOT EXISTS unsuspend_requests (
    id SERIAL PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL REFERENCES customers(address),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    processed_by VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Wallet registrations table (for role tracking)
CREATE TABLE IF NOT EXISTS wallet_registrations (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    registration_type VARCHAR(20) NOT NULL CHECK (registration_type IN ('customer', 'shop', 'admin')),
    entity_id VARCHAR(255) NOT NULL, -- customer address, shop_id, or admin ID
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_wallet ON customers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code);
CREATE INDEX IF NOT EXISTS idx_customers_referred_by ON customers(referred_by);
CREATE INDEX IF NOT EXISTS idx_customers_home_shop ON customers(home_shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_suspended ON customers(is_suspended);

-- Shop indexes
CREATE INDEX IF NOT EXISTS idx_shops_wallet ON shops(wallet_address);
CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(active);
CREATE INDEX IF NOT EXISTS idx_shops_verified ON shops(verified);
CREATE INDEX IF NOT EXISTS idx_shops_suspended ON shops(is_suspended);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_source_classification ON transactions(source_classification);

-- Shop purchase indexes
CREATE INDEX IF NOT EXISTS idx_shop_purchases_shop ON shop_rcn_purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_status ON shop_rcn_purchases(status);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_date ON shop_rcn_purchases(created_at);

-- Referral indexes
CREATE INDEX IF NOT EXISTS idx_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrer_address ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referee_address ON referrals(referee_address);
CREATE INDEX IF NOT EXISTS idx_referral_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_created ON referrals(created_at);

-- Customer RCN source indexes
CREATE INDEX IF NOT EXISTS idx_customer_source ON customer_rcn_sources(customer_address);
CREATE INDEX IF NOT EXISTS idx_source_type ON customer_rcn_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_source_shop ON customer_rcn_sources(source_shop_id);
CREATE INDEX IF NOT EXISTS idx_earned_at ON customer_rcn_sources(earned_at);
CREATE INDEX IF NOT EXISTS idx_redeemable ON customer_rcn_sources(is_redeemable);

-- Redemption session indexes
CREATE INDEX IF NOT EXISTS idx_redemption_customer ON redemption_sessions(customer_address);
CREATE INDEX IF NOT EXISTS idx_redemption_shop ON redemption_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_redemption_status ON redemption_sessions(status);
CREATE INDEX IF NOT EXISTS idx_redemption_session_id ON redemption_sessions(session_id);

-- Token source indexes
CREATE INDEX IF NOT EXISTS idx_token_sources_customer ON token_sources(customer_address);
CREATE INDEX IF NOT EXISTS idx_token_sources_source ON token_sources(source);
CREATE INDEX IF NOT EXISTS idx_token_sources_redeemable ON token_sources(is_redeemable_at_shops);

-- Wallet registration indexes
CREATE INDEX IF NOT EXISTS idx_wallet_type ON wallet_registrations(registration_type);
CREATE INDEX IF NOT EXISTS idx_wallet_active ON wallet_registrations(is_active);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS VARCHAR(20) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8 character code
    FOR i IN 1..8 LOOP
        result := result || SUBSTRING(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code for new customers
CREATE OR REPLACE FUNCTION assign_referral_code() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM customers WHERE referral_code = NEW.referral_code) LOOP
            NEW.referral_code := generate_referral_code();
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_referral_code_trigger
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION assign_referral_code();

-- Trigger to track customer RCN sources
CREATE OR REPLACE FUNCTION track_rcn_source() RETURNS TRIGGER AS $$
BEGIN
    -- Only track confirmed transactions
    IF NEW.status = 'confirmed' AND NEW.type IN ('mint', 'tier_bonus') THEN
        INSERT INTO customer_rcn_sources (
            customer_address,
            source_type,
            source_shop_id,
            amount,
            transaction_id,
            transaction_hash,
            is_redeemable,
            metadata
        ) VALUES (
            NEW.customer_address,
            CASE 
                WHEN NEW.type = 'mint' AND NEW.reason LIKE '%repair%' THEN 'shop_repair'
                WHEN NEW.type = 'mint' AND NEW.reason LIKE '%referral%' THEN 'referral_bonus'
                WHEN NEW.type = 'tier_bonus' THEN 'tier_bonus'
                ELSE 'other'
            END,
            NEW.shop_id,
            NEW.amount,
            NEW.id,
            NEW.transaction_hash,
            NEW.source_classification != 'market',
            jsonb_build_object('reason', NEW.reason, 'type', NEW.type)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_rcn_source_trigger
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION track_rcn_source();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Referral stats view
CREATE OR REPLACE VIEW referral_stats AS
SELECT 
    r.referrer_address,
    c.name as referrer_name,
    COUNT(DISTINCT r.referee_address) as total_referrals,
    COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.referee_address END) as successful_referrals,
    SUM(CASE WHEN r.status = 'completed' THEN 25 ELSE 0 END) as total_earned_rcn,
    MAX(r.created_at) as last_referral_date
FROM referrals r
LEFT JOIN customers c ON r.referrer_address = c.address
GROUP BY r.referrer_address, c.name;

-- Database health check view
CREATE OR REPLACE VIEW database_health AS
SELECT 
    'healthy' as status,
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COUNT(*) FROM shops) as total_shops,
    (SELECT COUNT(*) FROM transactions) as total_transactions,
    (SELECT COUNT(*) FROM webhook_logs) as total_webhook_logs,
    (SELECT COUNT(*) FROM shop_rcn_purchases) as total_shop_purchases,
    (SELECT COUNT(*) FROM customer_rcn_sources) as total_token_sources,
    (SELECT COUNT(*) FROM cross_shop_verifications) as total_verifications,
    (SELECT COUNT(*) FROM tier_bonuses) as total_tier_bonuses,
    CURRENT_TIMESTAMP as checked_at;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Initialize treasury with default values
INSERT INTO admin_treasury (id, total_supply, available_supply, total_sold, total_revenue)
VALUES (1, 1000000000, 1000000000, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Update existing customers with referral codes if missing
UPDATE customers 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- =====================================================
-- FINAL NOTES
-- =====================================================
-- This migration creates the complete RepairCoin database schema
-- Run this on a fresh database to set up all tables at once
-- For existing databases, check which tables already exist before running