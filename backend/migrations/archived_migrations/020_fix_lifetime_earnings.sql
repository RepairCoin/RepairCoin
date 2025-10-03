-- Migration: Fix lifetime earnings to match actual minted amounts
-- This ensures customer lifetime_earnings matches their actual token minting history

-- Update lifetime_earnings based on actual minted tokens from transactions
UPDATE customers c
SET lifetime_earnings = (
  SELECT COALESCE(SUM(t.amount), 0)
  FROM transactions t
  WHERE LOWER(t.customer_address) = LOWER(c.address)
  AND t.type IN ('mint', 'tier_bonus')
  AND t.status = 'confirmed'
),
updated_at = CURRENT_TIMESTAMP
WHERE c.address IS NOT NULL;

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated lifetime earnings for % customers', updated_count;
END $$;

-- Also update the total_redemptions field to match actual redemptions
UPDATE customers c
SET total_redemptions = (
  SELECT COALESCE(SUM(t.amount), 0)
  FROM transactions t
  WHERE LOWER(t.customer_address) = LOWER(c.address)
  AND t.type = 'redeem'
  AND t.status = 'confirmed'
),
updated_at = CURRENT_TIMESTAMP
WHERE c.address IS NOT NULL;

-- Log redemption update results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated total redemptions for % customers', updated_count;
END $$;