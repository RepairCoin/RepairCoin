-- Migration: Update to unlimited supply model for RCN tokens
-- Date: 2025-09-02
-- Description: Remove hardcoded 1 billion supply limit per v3.0 specifications

-- Update admin_treasury table to remove supply constraints
-- Note: We're keeping the columns for backward compatibility but changing their meaning
ALTER TABLE admin_treasury 
    ALTER COLUMN total_supply SET DEFAULT NULL,
    ALTER COLUMN available_supply SET DEFAULT NULL;

-- Add new columns to track the new model
ALTER TABLE admin_treasury
    ADD COLUMN IF NOT EXISTS supply_model VARCHAR(20) DEFAULT 'unlimited',
    ADD COLUMN IF NOT EXISTS circulating_supply NUMERIC(20, 8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing row to reflect unlimited supply
UPDATE admin_treasury 
SET 
    total_supply = NULL,  -- NULL represents unlimited
    available_supply = NULL,  -- NULL represents unlimited
    supply_model = 'unlimited',
    notes = 'Updated to unlimited supply model per RepairCoin v3.0 specifications',
    last_updated = CURRENT_TIMESTAMP
WHERE id = 1;

-- Add comment to explain the new model
COMMENT ON COLUMN admin_treasury.total_supply IS 'NULL = unlimited supply. Legacy column kept for backward compatibility.';
COMMENT ON COLUMN admin_treasury.available_supply IS 'NULL = unlimited availability. Legacy column kept for backward compatibility.';
COMMENT ON COLUMN admin_treasury.supply_model IS 'Supply model: unlimited or fixed';
COMMENT ON COLUMN admin_treasury.circulating_supply IS 'Actual tokens minted and in circulation';