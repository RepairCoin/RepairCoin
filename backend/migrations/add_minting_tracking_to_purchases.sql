-- Add minting tracking columns to shop_rcn_purchases
ALTER TABLE shop_rcn_purchases 
ADD COLUMN IF NOT EXISTS minted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_minted_at ON shop_rcn_purchases(minted_at);

-- Add comment for documentation
COMMENT ON COLUMN shop_rcn_purchases.minted_at IS 'Timestamp when the RCN was minted to blockchain';
COMMENT ON COLUMN shop_rcn_purchases.transaction_hash IS 'Blockchain transaction hash for the mint';