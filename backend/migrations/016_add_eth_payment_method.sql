-- Migration: Add ETH as a valid payment method for shop RCN purchases
-- Date: 2025-09-18
-- Description: Updates the payment_method check constraint to include 'eth' as a valid payment option

-- Drop the existing constraint
ALTER TABLE shop_rcn_purchases 
DROP CONSTRAINT IF EXISTS shop_rcn_purchases_payment_method_check;

-- Add the updated constraint with 'eth' included
ALTER TABLE shop_rcn_purchases 
ADD CONSTRAINT shop_rcn_purchases_payment_method_check 
CHECK (payment_method IN ('credit_card', 'bank_transfer', 'usdc', 'eth'));

-- Verify the constraint (for documentation purposes)
-- The constraint should now allow: 'credit_card', 'bank_transfer', 'usdc', 'eth'