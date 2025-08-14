-- Add wallet type tracking to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(20) DEFAULT 'external',
ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'wallet',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create wallet linking table for customers with multiple wallets
CREATE TABLE IF NOT EXISTS customer_wallets (
  id SERIAL PRIMARY KEY,
  customer_address VARCHAR(42) REFERENCES customers(address) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL CHECK (wallet_type IN ('embedded', 'external')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_address, wallet_address)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_wallets_address ON customer_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_address ON customer_wallets(customer_address);

-- Add comments for documentation
COMMENT ON COLUMN customers.wallet_type IS 'Type of wallet: embedded (email/social) or external (MetaMask, etc)';
COMMENT ON COLUMN customers.auth_method IS 'Authentication method: wallet, email, google, apple';
COMMENT ON COLUMN customers.email_verified IS 'Whether email has been verified for embedded wallet users';