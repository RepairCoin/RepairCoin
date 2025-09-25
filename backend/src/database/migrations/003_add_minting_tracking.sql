-- Migration: Add minting tracking to shop_rcn_purchases
-- Date: 2025-09-25
-- Description: Adds columns to track when RCN purchases have been minted on blockchain

-- Add minted_at column to track when tokens were minted
ALTER TABLE shop_rcn_purchases 
ADD COLUMN IF NOT EXISTS minted_at TIMESTAMP;

-- Add transaction_hash column to store the blockchain transaction
ALTER TABLE shop_rcn_purchases 
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255);

-- Add index for faster queries on unminted purchases
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_minted_at ON shop_rcn_purchases(minted_at);

-- Update the status check constraint to include 'minted' status
-- First drop the existing constraint if it exists
DO $$ 
BEGIN
    ALTER TABLE shop_rcn_purchases DROP CONSTRAINT IF EXISTS shop_rcn_purchases_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add the new constraint with 'minted' status
ALTER TABLE shop_rcn_purchases 
ADD CONSTRAINT shop_rcn_purchases_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'minted'));