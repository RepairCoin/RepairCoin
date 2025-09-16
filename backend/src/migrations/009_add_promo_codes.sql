-- Migration: Add promo codes system
-- Purpose: Allow shops to create promotional codes for bonus RCN rewards

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Bonus configuration
  bonus_type VARCHAR(20) NOT NULL CHECK (bonus_type IN ('fixed', 'percentage')),
  bonus_value NUMERIC(10, 2) NOT NULL CHECK (bonus_value > 0),
  max_bonus NUMERIC(10, 2), -- Maximum bonus for percentage type
  
  -- Validity period
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  
  -- Usage limits
  total_usage_limit INTEGER,
  per_customer_limit INTEGER DEFAULT 1,
  
  -- Tracking
  times_used INTEGER DEFAULT 0,
  total_bonus_issued NUMERIC(18, 2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT valid_percentage CHECK (
    bonus_type != 'percentage' OR (bonus_value <= 100 AND bonus_value > 0)
  )
);

-- Create promo_code_uses table to track individual uses
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id),
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  transaction_id VARCHAR(100) REFERENCES transactions(id),
  
  -- Usage details
  base_reward NUMERIC(18, 2) NOT NULL,
  bonus_amount NUMERIC(18, 2) NOT NULL,
  total_reward NUMERIC(18, 2) NOT NULL,
  
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique customer-code combination per transaction
  UNIQUE(promo_code_id, customer_address, transaction_id)
);

-- Indexes for performance
CREATE INDEX idx_promo_codes_shop_id ON promo_codes(shop_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active_dates ON promo_codes(is_active, start_date, end_date);
CREATE INDEX idx_promo_code_uses_customer ON promo_code_uses(customer_address);
CREATE INDEX idx_promo_code_uses_promo_code ON promo_code_uses(promo_code_id);

-- Function to validate promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR,
  p_shop_id VARCHAR,
  p_customer_address VARCHAR
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  promo_code_id INTEGER,
  bonus_type VARCHAR,
  bonus_value NUMERIC
) AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_customer_uses INTEGER;
BEGIN
  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND shop_id = p_shop_id;
  
  -- Check if code exists
  IF v_promo.id IS NULL THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Invalid promo code',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Check if code is active
  IF NOT v_promo.is_active THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Promo code is no longer active',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Check date validity
  IF CURRENT_TIMESTAMP < v_promo.start_date THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Promo code is not yet active',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Promo code has expired',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Check total usage limit
  IF v_promo.total_usage_limit IS NOT NULL AND v_promo.times_used >= v_promo.total_usage_limit THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Promo code has reached its usage limit',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Check per-customer usage limit
  SELECT COUNT(*) INTO v_customer_uses
  FROM promo_code_uses
  WHERE promo_code_id = v_promo.id
    AND customer_address = p_customer_address;
  
  IF v_promo.per_customer_limit IS NOT NULL AND v_customer_uses >= v_promo.per_customer_limit THEN
    RETURN QUERY SELECT 
      FALSE, 
      'You have already used this promo code the maximum number of times',
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Code is valid
  RETURN QUERY SELECT 
    TRUE,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type,
    v_promo.bonus_value;
END;
$$ LANGUAGE plpgsql;

-- Sample promo codes for testing (commented out for production)
-- INSERT INTO promo_codes (code, shop_id, name, description, bonus_type, bonus_value, start_date, end_date, total_usage_limit, per_customer_limit)
-- VALUES 
-- ('WELCOME10', 'SHOP001', 'Welcome Bonus', 'Get 10 extra RCN on your first repair', 'fixed', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 100, 1),
-- ('SUMMER20', 'SHOP001', 'Summer Special', 'Get 20% bonus RCN this summer', 'percentage', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '60 days', NULL, 3);