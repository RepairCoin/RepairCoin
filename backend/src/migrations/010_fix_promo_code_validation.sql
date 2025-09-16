-- Fix the validate_promo_code function to resolve ambiguous column reference
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR(20),
  p_shop_id VARCHAR(255),
  p_customer_address VARCHAR(42)
)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT,
  promo_code_id INTEGER,
  bonus_type VARCHAR(20),
  bonus_value NUMERIC(10, 2)
) AS $$
DECLARE
  v_promo RECORD;
  v_usage_count INTEGER;
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
      'Invalid promo code',
      NULL::INTEGER,
      NULL::VARCHAR(20),
      NULL::NUMERIC(10, 2);
    RETURN;
  END IF;
  
  -- Check date validity
  IF CURRENT_TIMESTAMP < v_promo.start_date THEN
    RETURN QUERY SELECT 
      false,
      'Promo code not yet active',
      v_promo.id,
      v_promo.bonus_type,
      v_promo.bonus_value;
    RETURN;
  END IF;
  
  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT 
      false,
      'Promo code has expired',
      v_promo.id,
      v_promo.bonus_type,
      v_promo.bonus_value;
    RETURN;
  END IF;
  
  -- Check total usage limit
  IF v_promo.total_usage_limit IS NOT NULL THEN
    IF v_promo.times_used >= v_promo.total_usage_limit THEN
      RETURN QUERY SELECT 
        false,
        'Promo code usage limit reached',
        v_promo.id,
        v_promo.bonus_type,
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
        'You have already used this promo code',
        v_promo.id,
        v_promo.bonus_type,
        v_promo.bonus_value;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type,
    v_promo.bonus_value;
END;
$$ LANGUAGE plpgsql;