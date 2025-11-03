-- Migration: Add max_bonus to validate_promo_code function
-- This allows the frontend to properly cap percentage-based promo bonuses

BEGIN;

-- Drop the old function
DROP FUNCTION IF EXISTS validate_promo_code(VARCHAR, VARCHAR, VARCHAR);

-- Recreate with max_bonus in the return type
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
  bonus_value NUMERIC,
  max_bonus NUMERIC
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
      NULL::NUMERIC(10, 2),
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
      v_promo.bonus_value,
      v_promo.max_bonus;
    RETURN;
  END IF;

  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT
      false,
      'Promo code has expired'::TEXT,
      v_promo.id,
      v_promo.bonus_type::VARCHAR(20),
      v_promo.bonus_value,
      v_promo.max_bonus;
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
        v_promo.bonus_value,
        v_promo.max_bonus;
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
        v_promo.bonus_value,
        v_promo.max_bonus;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type::VARCHAR(20),
    v_promo.bonus_value,
    v_promo.max_bonus;
END;
$$;

COMMIT;

-- Verify the function was updated
SELECT 'SUCCESS: validate_promo_code function updated to include max_bonus' as status;
