-- Migration: Add treasury-related tables
-- Date: 2025-09-23
-- Description: Creates tables needed for treasury functionality

-- Create shop_rcn_purchases table for tracking shop RCN purchases
CREATE TABLE IF NOT EXISTS shop_rcn_purchases (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
    amount DECIMAL(20, 2) NOT NULL,
    price_per_rcn DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(20, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'stripe',
    payment_reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT
);

-- Create indexes for shop_rcn_purchases
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_shop_id ON shop_rcn_purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_status ON shop_rcn_purchases(status);
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_created_at ON shop_rcn_purchases(created_at);

-- Create revenue_distributions table for tracking revenue sharing
CREATE TABLE IF NOT EXISTS revenue_distributions (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(20, 2) NOT NULL,
    distribution_type VARCHAR(50) NOT NULL, -- 'staking_rewards', 'dao_treasury', etc.
    recipient_address VARCHAR(255),
    transaction_hash VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    metadata JSONB
);

-- Create indexes for revenue_distributions
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_type ON revenue_distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_status ON revenue_distributions(status);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_created_at ON revenue_distributions(created_at);

-- Add shop tier and RCG balance columns to shops table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shops' AND column_name='tier') THEN
        ALTER TABLE shops ADD COLUMN tier VARCHAR(50) DEFAULT 'standard';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shops' AND column_name='rcg_balance') THEN
        ALTER TABLE shops ADD COLUMN rcg_balance DECIMAL(20, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='shops' AND column_name='purchased_rcn_balance') THEN
        ALTER TABLE shops ADD COLUMN purchased_rcn_balance DECIMAL(20, 2) DEFAULT 0;
    END IF;
END $$;

-- Add sample data for testing (only in development)
-- DO $$ 
-- BEGIN
--     IF (SELECT COUNT(*) FROM shop_rcn_purchases) = 0 THEN
--         INSERT INTO shop_rcn_purchases (shop_id, amount, price_per_rcn, total_cost, status)
--         SELECT 
--             shop_id, 
--             1000, 
--             0.09, 
--             90, 
--             'completed'
--         FROM shops 
--         WHERE active = true 
--         LIMIT 1;
--     END IF;
-- END $$;