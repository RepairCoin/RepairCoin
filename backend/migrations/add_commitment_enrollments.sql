-- Commitment Program Enrollments
CREATE TABLE IF NOT EXISTS commitment_enrollments (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL UNIQUE REFERENCES shops(shop_id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, active, completed, cancelled, defaulted
  monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  term_months INTEGER NOT NULL DEFAULT 6,
  total_commitment NUMERIC(10,2) NOT NULL DEFAULT 3000.00,
  
  -- Billing information
  billing_method VARCHAR(50), -- credit_card, ach, wire
  billing_reference VARCHAR(255), -- Stripe customer ID, etc
  
  -- Payment tracking
  payments_made INTEGER DEFAULT 0,
  total_paid NUMERIC(10,2) DEFAULT 0,
  next_payment_date DATE,
  last_payment_date DATE,
  
  -- Dates
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Metadata
  cancellation_reason TEXT,
  notes TEXT,
  created_by VARCHAR(255),
  
  CONSTRAINT check_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'defaulted')),
  CONSTRAINT check_payments CHECK (payments_made <= term_months),
  CONSTRAINT check_billing_method CHECK (billing_method IN ('credit_card', 'ach', 'wire'))
);

-- Index for quick lookups
CREATE INDEX idx_commitment_shop_id ON commitment_enrollments(shop_id);
CREATE INDEX idx_commitment_status ON commitment_enrollments(status);
CREATE INDEX idx_commitment_next_payment ON commitment_enrollments(next_payment_date) WHERE status = 'active';

-- Add commitment status to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS commitment_enrolled BOOLEAN DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) DEFAULT 'pending'; -- pending, rcg_qualified, commitment_qualified, not_qualified

-- Function to check if shop is operational
CREATE OR REPLACE FUNCTION is_shop_operational(p_shop_id VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
  v_shop RECORD;
  v_commitment RECORD;
BEGIN
  -- Get shop details
  SELECT * INTO v_shop FROM shops WHERE shop_id = p_shop_id;
  
  IF NOT FOUND OR NOT v_shop.active OR NOT v_shop.verified THEN
    RETURN FALSE;
  END IF;
  
  -- Check RCG balance (assuming we store it)
  IF v_shop.rcg_balance >= 10000 THEN
    RETURN TRUE;
  END IF;
  
  -- Check active commitment
  SELECT * INTO v_commitment 
  FROM commitment_enrollments 
  WHERE shop_id = p_shop_id AND status = 'active';
  
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Update shop operational status trigger
CREATE OR REPLACE FUNCTION update_shop_operational_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rcg_balance >= 10000 THEN
    NEW.operational_status = 'rcg_qualified';
  ELSIF EXISTS (
    SELECT 1 FROM commitment_enrollments 
    WHERE shop_id = NEW.shop_id AND status = 'active'
  ) THEN
    NEW.operational_status = 'commitment_qualified';
  ELSE
    NEW.operational_status = 'not_qualified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_operational_status 
BEFORE INSERT OR UPDATE ON shops
FOR EACH ROW EXECUTE FUNCTION update_shop_operational_status();