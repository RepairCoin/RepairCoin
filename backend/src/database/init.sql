-- database/init.sql - PostgreSQL Schema for RepairCoin

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mint', 'redeem', 'transfer')),
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL,
    reason TEXT,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    timestamp TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id VARCHAR(100) PRIMARY KEY,
    source VARCHAR(20) NOT NULL CHECK (source IN ('fixflow', 'admin', 'customer')),
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processing_time INTEGER, -- in milliseconds
    result JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_earnings ON customers(lifetime_earnings);

CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(active);
CREATE INDEX IF NOT EXISTS idx_shops_verified ON shops(verified);
CREATE INDEX IF NOT EXISTS idx_shops_location ON shops(location_city, location_state);

CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);

CREATE INDEX IF NOT EXISTS idx_webhooks_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhook_logs(event);
CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_webhooks_timestamp ON webhook_logs(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shops_updated_at 
    BEFORE UPDATE ON shops 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO customers (address, name, email, phone, wallet_address, tier, lifetime_earnings) VALUES
('0x1234567890123456789012345678901234567890', 'John Doe', 'john@example.com', '+1234567890', '0x1234567890123456789012345678901234567890', 'BRONZE', 150.50),
('0x2345678901234567890123456789012345678901', 'Jane Smith', 'jane@example.com', '+1987654321', '0x2345678901234567890123456789012345678901', 'SILVER', 450.75),
('0x3456789012345678901234567890123456789012', 'Bob Wilson', 'bob@example.com', '+1122334455', '0x3456789012345678901234567890123456789012', 'GOLD', 1250.00)
ON CONFLICT (address) DO NOTHING;

INSERT INTO shops (shop_id, name, address, phone, email, wallet_address, verified, active) VALUES
('shop001', 'Tech Repair Pro', '123 Main St, Anytown, ST 12345', '+1555123456', 'info@techrepairpro.com', '0x7890123456789012345678901234567890123456', true, true),
('shop002', 'Quick Fix Electronics', '456 Oak Ave, Somewhere, ST 67890', '+1555654321', 'hello@quickfix.com', '0x8901234567890123456789012345678901234567', true, true),
('shop003', 'Mobile Masters', '789 Pine Rd, Elsewhere, ST 11111', '+1555987654', 'contact@mobilemasters.com', '0x9012345678901234567890123456789012345678', false, true)
ON CONFLICT (shop_id) DO NOTHING;

-- Create a simple health check view
CREATE OR REPLACE VIEW system_health AS
SELECT 
    'healthy' as status,
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COUNT(*) FROM shops) as total_shops,
    (SELECT COUNT(*) FROM transactions) as total_transactions,
    (SELECT COUNT(*) FROM webhook_logs) as total_webhook_logs,
    CURRENT_TIMESTAMP as checked_at;