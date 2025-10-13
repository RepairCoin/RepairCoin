-- Migration: Enhanced Customer Balance Tracking
-- Description: Add database balance tracking columns to support hybrid database/blockchain RCN system
-- Date: 2025-10-09

-- Add enhanced balance tracking columns to customers table
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS current_rcn_balance NUMERIC(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_mint_balance NUMERIC(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_blockchain_sync TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_redemptions NUMERIC(20,8) DEFAULT 0;

-- Create index for efficient balance queries
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(current_rcn_balance);
CREATE INDEX IF NOT EXISTS idx_customers_pending_mint ON customers(pending_mint_balance);

-- Add comments for documentation
COMMENT ON COLUMN customers.current_rcn_balance IS 'Real-time RCN balance available for redemption (database-first)';
COMMENT ON COLUMN customers.pending_mint_balance IS 'RCN tokens queued for blockchain minting (mint-to-wallet feature)';
COMMENT ON COLUMN customers.last_blockchain_sync IS 'Last time customer balance was synced with blockchain';
COMMENT ON COLUMN customers.total_redemptions IS 'Total RCN redeemed by customer (for balance calculation)';

-- Initialize current_rcn_balance from existing lifetime_earnings minus total redemptions
UPDATE customers 
SET current_rcn_balance = GREATEST(0, 
  COALESCE(lifetime_earnings, 0) - 
  COALESCE((
    SELECT SUM(amount) 
    FROM transactions t 
    WHERE t.customer_address = customers.address 
    AND t.type = 'redeem'
  ), 0)
)
WHERE current_rcn_balance IS NULL OR current_rcn_balance = 0;

-- Initialize total_redemptions from existing transaction data
UPDATE customers 
SET total_redemptions = COALESCE((
  SELECT SUM(amount) 
  FROM transactions t 
  WHERE t.customer_address = customers.address 
  AND t.type = 'redeem'
), 0)
WHERE total_redemptions IS NULL OR total_redemptions = 0;

-- Create a function to automatically update balance on earning/redemption
CREATE OR REPLACE FUNCTION update_customer_balance() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'mint' THEN
    -- Increase balance on earning
    UPDATE customers 
    SET current_rcn_balance = COALESCE(current_rcn_balance, 0) + NEW.amount,
        updated_at = NOW()
    WHERE address = NEW.customer_address;
  ELSIF NEW.type = 'redeem' THEN
    -- Decrease balance on redemption
    UPDATE customers 
    SET current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - NEW.amount),
        total_redemptions = COALESCE(total_redemptions, 0) + NEW.amount,
        updated_at = NOW()
    WHERE address = NEW.customer_address;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update balance when transactions occur
DROP TRIGGER IF EXISTS trigger_update_customer_balance ON transactions;
CREATE TRIGGER trigger_update_customer_balance
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_balance();

-- Create a view for easy balance querying
CREATE OR REPLACE VIEW customer_balance_summary AS
SELECT 
  c.address,
  c.name,
  c.tier,
  c.lifetime_earnings,
  c.current_rcn_balance,
  c.pending_mint_balance,
  c.total_redemptions,
  c.last_blockchain_sync,
  c.is_active,
  -- Calculate derived fields
  (c.current_rcn_balance + c.pending_mint_balance) as total_balance,
  (c.lifetime_earnings - c.total_redemptions) as calculated_balance,
  -- Check if balances are in sync
  ABS(c.current_rcn_balance - (c.lifetime_earnings - c.total_redemptions)) < 0.00000001 as balance_synced
FROM customers c
WHERE c.is_active = true
ORDER BY c.current_rcn_balance DESC;

-- Grant permissions to application role if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repaircoin_app') THEN
    GRANT SELECT ON customer_balance_summary TO repaircoin_app;
  END IF;
END $$;