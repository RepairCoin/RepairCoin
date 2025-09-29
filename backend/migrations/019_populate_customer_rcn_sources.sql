-- Migration: Populate customer_rcn_sources from historical transactions
-- This ensures the earned balance tracking is accurate

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS customer_rcn_sources (
  id SERIAL PRIMARY KEY,
  customer_address VARCHAR(42) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_shop_id VARCHAR(100),
  amount NUMERIC(20,2) NOT NULL,
  transaction_id VARCHAR(255),
  transaction_hash TEXT,
  is_redeemable BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_address) REFERENCES customers(address),
  FOREIGN KEY (source_shop_id) REFERENCES shops(shop_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_customer_source ON customer_rcn_sources(customer_address);
CREATE INDEX IF NOT EXISTS idx_source_type ON customer_rcn_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_source_shop ON customer_rcn_sources(source_shop_id);
CREATE INDEX IF NOT EXISTS idx_redeemable ON customer_rcn_sources(is_redeemable);
CREATE INDEX IF NOT EXISTS idx_earned_at ON customer_rcn_sources(earned_at);

-- Clear existing data to avoid duplicates
TRUNCATE TABLE customer_rcn_sources;

-- Populate from transactions table
INSERT INTO customer_rcn_sources (
  customer_address,
  source_type,
  source_shop_id,
  amount,
  transaction_id,
  transaction_hash,
  is_redeemable,
  metadata,
  earned_at
)
SELECT 
  LOWER(t.customer_address) as customer_address,
  CASE 
    WHEN t.reason LIKE '%Referral%' THEN 'referral_bonus'
    WHEN t.reason LIKE '%Tier bonus%' THEN 'tier_bonus'  
    WHEN t.reason LIKE '%Repair%' THEN 'shop_repair'
    WHEN t.reason LIKE '%Promotion%' THEN 'promotion'
    ELSE 'shop_repair'
  END as source_type,
  t.shop_id as source_shop_id,
  t.amount,
  t.id as transaction_id,
  t.transaction_hash,
  true as is_redeemable, -- All earned tokens are redeemable
  COALESCE(t.metadata, '{}')::jsonb as metadata,
  t.timestamp as earned_at
FROM transactions t
WHERE t.type IN ('mint', 'tier_bonus')
  AND t.status = 'confirmed'
  AND t.customer_address IS NOT NULL
  AND t.amount > 0
ORDER BY t.timestamp;

-- Log the migration
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM customer_rcn_sources;
  RAISE NOTICE 'Populated customer_rcn_sources with % records', row_count;
END $$;