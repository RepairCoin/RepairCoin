-- Migration: Create promo codes tables with correct schema
-- This schema matches the application interface expectations

BEGIN;

-- Drop existing objects if they exist
DROP TABLE IF EXISTS promo_code_uses CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP SEQUENCE IF EXISTS promo_codes_id_seq CASCADE;
DROP SEQUENCE IF EXISTS promo_code_uses_id_seq CASCADE;

-- Create sequences
CREATE SEQUENCE promo_codes_id_seq;
CREATE SEQUENCE promo_code_uses_id_seq;

-- Create promo_codes table (matching your desired schema)
CREATE TABLE promo_codes (
  id INT4 DEFAULT nextval('promo_codes_id_seq'::regclass) NOT NULL,
  code VARCHAR(20) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  bonus_type VARCHAR(20) NOT NULL,
  bonus_value NUMERIC(10,2) NOT NULL,
  max_bonus NUMERIC(10,2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  total_usage_limit INT4,
  per_customer_limit INT4 DEFAULT 1,
  times_used INT4 DEFAULT 0,
  total_bonus_issued NUMERIC(18,2) DEFAULT 0,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id)
);

-- Create promo_code_uses table
CREATE TABLE promo_code_uses (
  id INT4 DEFAULT nextval('promo_code_uses_id_seq'::regclass) NOT NULL,
  promo_code_id INT4 NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  transaction_id VARCHAR(100),
  base_reward NUMERIC(18,2) NOT NULL,
  bonus_amount NUMERIC(18,2) NOT NULL,
  total_reward NUMERIC(18,2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id),
  CONSTRAINT promo_code_uses_promo_code_fkey FOREIGN KEY (promo_code_id)
    REFERENCES promo_codes(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_promo_codes_code ON promo_codes(UPPER(code));
CREATE INDEX idx_promo_codes_shop_id ON promo_codes(shop_id);
CREATE INDEX idx_promo_codes_is_active ON promo_codes(is_active);
CREATE INDEX idx_promo_codes_dates ON promo_codes(start_date, end_date);
CREATE INDEX idx_promo_code_uses_promo_code_id ON promo_code_uses(promo_code_id);
CREATE INDEX idx_promo_code_uses_customer_address ON promo_code_uses(customer_address);
CREATE INDEX idx_promo_code_uses_shop_id ON promo_code_uses(shop_id);

-- Add unique constraint for promo code per shop
CREATE UNIQUE INDEX idx_promo_codes_code_shop_unique ON promo_codes(UPPER(code), shop_id);

-- Create validation function
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR,
  p_shop_id VARCHAR,
  p_customer_address VARCHAR
)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT,
  promo_code_id INTEGER,
  bonus_type VARCHAR,
  bonus_value NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_promo RECORD;
  v_customer_uses INTEGER;
BEGIN
  -- Normalize inputs
  p_code := UPPER(TRIM(p_code));
  p_customer_address := LOWER(TRIM(p_customer_address));

  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = p_code
    AND shop_id = p_shop_id
    AND is_active = true;

  -- Check if promo code exists
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT
      false,
      'Invalid promo code'::TEXT,
      NULL::INTEGER,
      NULL::VARCHAR(20),
      NULL::NUMERIC(10, 2);
    RETURN;
  END IF;

  -- Check date validity
  IF CURRENT_TIMESTAMP < v_promo.start_date THEN
    RETURN QUERY SELECT
      false,
      'Promo code not yet active'::TEXT,
      v_promo.id,
      v_promo.bonus_type::VARCHAR(20),
      v_promo.bonus_value;
    RETURN;
  END IF;

  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT
      false,
      'Promo code has expired'::TEXT,
      v_promo.id,
      v_promo.bonus_type::VARCHAR(20),
      v_promo.bonus_value;
    RETURN;
  END IF;

  -- Check total usage limit
  IF v_promo.total_usage_limit IS NOT NULL THEN
    IF v_promo.times_used >= v_promo.total_usage_limit THEN
      RETURN QUERY SELECT
        false,
        'Promo code usage limit reached'::TEXT,
        v_promo.id,
        v_promo.bonus_type::VARCHAR(20),
        v_promo.bonus_value;
      RETURN;
    END IF;
  END IF;

  -- Check per-customer usage limit
  IF v_promo.per_customer_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_uses
    FROM promo_code_uses pcu
    WHERE pcu.promo_code_id = v_promo.id
      AND pcu.customer_address = p_customer_address;

    IF v_customer_uses >= v_promo.per_customer_limit THEN
      RETURN QUERY SELECT
        false,
        'You have already used this promo code'::TEXT,
        v_promo.id,
        v_promo.bonus_type::VARCHAR(20),
        v_promo.bonus_value;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type::VARCHAR(20),
    v_promo.bonus_value;
END;
$$;

COMMIT;

-- Verify tables were created
SELECT 'SUCCESS: promo_codes table created with ' || COUNT(*) || ' columns' as status
FROM information_schema.columns
WHERE table_name = 'promo_codes';

SELECT 'SUCCESS: promo_code_uses table created with ' || COUNT(*) || ' columns' as status
FROM information_schema.columns
WHERE table_name = 'promo_code_uses';
