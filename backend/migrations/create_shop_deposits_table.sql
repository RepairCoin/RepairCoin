-- Create shop_deposits table for tracking RCN deposits from wallet to operational balance
CREATE TABLE IF NOT EXISTS shop_deposits (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
    amount DECIMAL(20, 2) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, failed
    transaction_hash VARCHAR(255),
    transaction_note TEXT,
    deposit_type VARCHAR(50) NOT NULL DEFAULT 'wallet_to_operational', -- wallet_to_operational, admin_allocation
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    CONSTRAINT shop_deposits_positive_amount CHECK (amount > 0)
);

-- Add indexes for performance
CREATE INDEX idx_shop_deposits_shop_id ON shop_deposits(shop_id);
CREATE INDEX idx_shop_deposits_status ON shop_deposits(status);
CREATE INDEX idx_shop_deposits_created_at ON shop_deposits(created_at DESC);

-- Add comment for table documentation
COMMENT ON TABLE shop_deposits IS 'Tracks RCN deposits from shop wallets to their operational balances';
COMMENT ON COLUMN shop_deposits.amount IS 'Amount of RCN being deposited';
COMMENT ON COLUMN shop_deposits.status IS 'Status of the deposit: pending, completed, or failed';
COMMENT ON COLUMN shop_deposits.deposit_type IS 'Type of deposit: wallet_to_operational for shop-initiated, admin_allocation for admin-initiated';