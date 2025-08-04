-- Create referrals table to track referral relationships
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

-- Create indexes for referrals table
CREATE INDEX IF NOT EXISTS idx_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrer_address ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referee_address ON referrals(referee_address);
CREATE INDEX IF NOT EXISTS idx_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON referrals(created_at);

-- Create customer_rcn_sources table to track where customers earned their RCN
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

-- Create indexes for customer_rcn_sources table
CREATE INDEX IF NOT EXISTS idx_customer_source ON customer_rcn_sources(customer_address);
CREATE INDEX IF NOT EXISTS idx_source_type ON customer_rcn_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_source_shop ON customer_rcn_sources(source_shop_id);
CREATE INDEX IF NOT EXISTS idx_earned_at ON customer_rcn_sources(earned_at);
CREATE INDEX IF NOT EXISTS idx_redeemable ON customer_rcn_sources(is_redeemable);

-- Create referral_stats view for analytics
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

-- Add columns to existing tables
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by VARCHAR(42) REFERENCES customers(address);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS home_shop_id VARCHAR(50) REFERENCES shops(shop_id);

-- Update transactions table to include source tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_classification VARCHAR(20) DEFAULT 'earned'; -- 'earned' or 'market'

-- Create function to generate unique referral codes
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

-- Create trigger to auto-generate referral code for new customers
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

-- Create trigger to track customer RCN sources
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

-- Update existing customer data with referral codes
UPDATE customers 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code);
CREATE INDEX IF NOT EXISTS idx_customers_referred_by ON customers(referred_by);
CREATE INDEX IF NOT EXISTS idx_customers_home_shop ON customers(home_shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source_classification ON transactions(source_classification);