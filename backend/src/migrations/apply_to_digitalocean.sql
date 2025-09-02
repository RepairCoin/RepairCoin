-- =====================================================
-- RepairCoin v3.0 Unlimited Supply Migration
-- For: DigitalOcean Database
-- Date: 2025-09-02
-- =====================================================

-- Step 1: Check current state
SELECT 'Current Treasury State:' as info;
SELECT * FROM admin_treasury;

-- Step 2: Apply unlimited supply migration
\echo 'Applying unlimited supply migration...'

-- Ensure admin_treasury exists
CREATE TABLE IF NOT EXISTS admin_treasury (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_supply NUMERIC(20, 8) DEFAULT 1000000000,
    available_supply NUMERIC(20, 8) DEFAULT 1000000000,
    total_sold NUMERIC(20, 8) DEFAULT 0,
    total_revenue NUMERIC(20, 8) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (id = 1)
);

-- Insert default row if not exists
INSERT INTO admin_treasury (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Update columns for unlimited supply
ALTER TABLE admin_treasury 
    ALTER COLUMN total_supply SET DEFAULT NULL,
    ALTER COLUMN available_supply SET DEFAULT NULL;

-- Add new columns
ALTER TABLE admin_treasury
    ADD COLUMN IF NOT EXISTS supply_model VARCHAR(20) DEFAULT 'unlimited',
    ADD COLUMN IF NOT EXISTS circulating_supply NUMERIC(20, 8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update to unlimited supply
UPDATE admin_treasury 
SET 
    total_supply = NULL,
    available_supply = NULL,
    supply_model = 'unlimited',
    notes = 'Updated to unlimited supply model per RepairCoin v3.0 specifications',
    last_updated = CURRENT_TIMESTAMP
WHERE id = 1;

-- Add column comments
COMMENT ON COLUMN admin_treasury.total_supply IS 'NULL = unlimited supply. Legacy column kept for backward compatibility.';
COMMENT ON COLUMN admin_treasury.available_supply IS 'NULL = unlimited availability. Legacy column kept for backward compatibility.';
COMMENT ON COLUMN admin_treasury.supply_model IS 'Supply model: unlimited or fixed';
COMMENT ON COLUMN admin_treasury.circulating_supply IS 'Actual tokens minted and in circulation';

-- Step 3: Verify the migration
\echo 'Migration complete! New treasury state:'
SELECT * FROM admin_treasury;

\echo 'Table structure:'
\d+ admin_treasury