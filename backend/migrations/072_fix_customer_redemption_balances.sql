-- Migration: Fix customer redemption balances
-- Date: 2026-03-10
-- Issue: Redemptions since Oct 2025 were not deducting from customer balances
-- This migration recalculates total_redemptions and current_rcn_balance from transaction history

-- Step 1: Create a temporary table with correct redemption totals from transactions
CREATE TEMP TABLE correct_redemptions AS
SELECT
  customer_address,
  COALESCE(SUM(ABS(amount)), 0) as calculated_total_redemptions
FROM transactions
WHERE type IN ('redemption', 'service_redemption')
  AND status IN ('confirmed', 'completed')
GROUP BY customer_address;

-- Step 2: Log customers that will be affected (for audit purposes)
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM customers c
  LEFT JOIN correct_redemptions cr ON c.address = cr.customer_address
  WHERE COALESCE(c.total_redemptions, 0) != COALESCE(cr.calculated_total_redemptions, 0);

  RAISE NOTICE 'Customers with mismatched redemption totals: %', affected_count;
END $$;

-- Step 3: Update customers with correct total_redemptions
UPDATE customers c
SET
  total_redemptions = COALESCE(cr.calculated_total_redemptions, 0),
  updated_at = NOW()
FROM correct_redemptions cr
WHERE c.address = cr.customer_address
  AND COALESCE(c.total_redemptions, 0) != COALESCE(cr.calculated_total_redemptions, 0);

-- Step 4: Recalculate current_rcn_balance based on:
-- current_rcn_balance = lifetime_earnings - total_redemptions - pending_mint - minted_to_wallet
-- Note: We only update if the balance is off by more than a small epsilon to avoid floating point issues
UPDATE customers
SET
  current_rcn_balance = GREATEST(0,
    COALESCE(lifetime_earnings, 0) -
    COALESCE(total_redemptions, 0) -
    COALESCE(pending_mint, 0) -
    COALESCE(minted_to_wallet, 0)
  ),
  updated_at = NOW()
WHERE ABS(
  COALESCE(current_rcn_balance, 0) -
  GREATEST(0,
    COALESCE(lifetime_earnings, 0) -
    COALESCE(total_redemptions, 0) -
    COALESCE(pending_mint, 0) -
    COALESCE(minted_to_wallet, 0)
  )
) > 0.00001;

-- Step 5: Log final state
DO $$
DECLARE
  total_customers INTEGER;
  customers_with_balance INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_customers FROM customers;
  SELECT COUNT(*) INTO customers_with_balance FROM customers WHERE current_rcn_balance > 0;

  RAISE NOTICE 'Migration complete. Total customers: %, Customers with positive balance: %', total_customers, customers_with_balance;
END $$;

-- Cleanup temp table
DROP TABLE IF EXISTS correct_redemptions;
