-- RepairCoin Database Schema
-- Run this to initialize the database

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    address VARCHAR(42) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    tier VARCHAR(20) DEFAULT 'BRONZE',
    lifetime_rcn_earned NUMERIC(10, 2) DEFAULT 0,
    lifetime_rcn_redeemed NUMERIC(10, 2) DEFAULT 0,
    last_earned_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
    shop_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    reimbursement_address VARCHAR(42),
    verified BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    cross_shop_enabled BOOLEAN DEFAULT false,
    total_tokens_issued NUMERIC(10, 2) DEFAULT 0,
    total_redemptions NUMERIC(10, 2) DEFAULT 0,
    total_reimbursements NUMERIC(10, 2) DEFAULT 0,
    purchased_rcn_balance NUMERIC(10, 2) DEFAULT 0,
    total_rcn_purchased NUMERIC(10, 2) DEFAULT 0,
    last_purchase_date TIMESTAMP,
    minimum_balance_alert NUMERIC(10, 2) DEFAULT 100,
    auto_purchase_enabled BOOLEAN DEFAULT false,
    auto_purchase_amount NUMERIC(10, 2) DEFAULT 1000,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fixflow_shop_id VARCHAR(100),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_zip VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    reason TEXT,
    transaction_hash VARCHAR(100),
    block_number INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create shop_rcn_purchases table
CREATE TABLE IF NOT EXISTS shop_rcn_purchases (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
    amount NUMERIC(10, 2) NOT NULL,
    price_per_rcn NUMERIC(10, 2) DEFAULT 1.00,
    total_cost NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create admin_treasury table
CREATE TABLE IF NOT EXISTS admin_treasury (
    id SERIAL PRIMARY KEY,
    total_supply NUMERIC(15, 2) DEFAULT 1000000000,
    total_sold NUMERIC(15, 2) DEFAULT 0,
    total_revenue NUMERIC(15, 2) DEFAULT 0,
    available_supply NUMERIC(15, 2) DEFAULT 1000000000,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize treasury if not exists
INSERT INTO admin_treasury (id, total_supply, available_supply)
VALUES (1, 1000000000, 1000000000)
ON CONFLICT (id) DO NOTHING;

-- Create admin_activity_logs table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_address VARCHAR(42) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    action_description TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_alerts table
CREATE TABLE IF NOT EXISTS admin_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_address ON customers(address);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_shops_wallet ON shops(wallet_address);
CREATE INDEX IF NOT EXISTS idx_shops_verified ON shops(verified);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_activity_logs(admin_address);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON admin_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON admin_alerts(severity);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();