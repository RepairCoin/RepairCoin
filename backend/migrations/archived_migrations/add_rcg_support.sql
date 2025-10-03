-- Add RCG-related columns to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS rcg_tier VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS rcg_balance NUMERIC(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rcg_staked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS commitment_path BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commitment_monthly_amount NUMERIC(10,2);

-- Create index for tier queries
CREATE INDEX IF NOT EXISTS idx_shops_rcg_tier ON shops(rcg_tier) WHERE rcg_tier != 'none';

-- Create revenue distributions tracking table
CREATE TABLE IF NOT EXISTS revenue_distributions (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_rcn_sold NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_revenue_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  operations_share NUMERIC(18,2) NOT NULL DEFAULT 0,
  stakers_share NUMERIC(18,2) NOT NULL DEFAULT 0,
  dao_treasury_share NUMERIC(18,2) NOT NULL DEFAULT 0,
  distributed BOOLEAN DEFAULT FALSE,
  distributed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, week_end)
);

-- Create RCG staking records table (for future use)
CREATE TABLE IF NOT EXISTS rcg_staking (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  staked_amount NUMERIC(18,2) NOT NULL,
  staked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlock_date TIMESTAMP NOT NULL,
  unstake_requested_at TIMESTAMP,
  rewards_claimed NUMERIC(18,2) DEFAULT 0,
  last_claim_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for staking queries
CREATE INDEX IF NOT EXISTS idx_rcg_staking_wallet ON rcg_staking(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rcg_staking_active ON rcg_staking(unstake_requested_at) WHERE unstake_requested_at IS NULL;

-- Add trigger to update tier when RCG balance changes
CREATE OR REPLACE FUNCTION update_shop_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rcg_balance >= 200000 THEN
    NEW.rcg_tier = 'elite';
  ELSIF NEW.rcg_balance >= 50000 THEN
    NEW.rcg_tier = 'premium';
  ELSIF NEW.rcg_balance >= 10000 THEN
    NEW.rcg_tier = 'standard';
  ELSE
    NEW.rcg_tier = 'none';
  END IF;
  
  NEW.tier_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_shop_tier_trigger ON shops;
CREATE TRIGGER update_shop_tier_trigger
BEFORE UPDATE OF rcg_balance ON shops
FOR EACH ROW
WHEN (OLD.rcg_balance IS DISTINCT FROM NEW.rcg_balance)
EXECUTE FUNCTION update_shop_tier();

-- Add comment for documentation
COMMENT ON COLUMN shops.rcg_tier IS 'Shop tier based on RCG holdings: none (<10k), standard (10k-49k), premium (50k-199k), elite (200k+)';
COMMENT ON COLUMN shops.rcg_balance IS 'Current RCG token balance for tier calculation';
COMMENT ON COLUMN shops.commitment_path IS 'Whether shop qualified via monthly purchase commitment instead of RCG holdings';
COMMENT ON COLUMN shops.commitment_monthly_amount IS 'Monthly RCN purchase commitment amount in USD';