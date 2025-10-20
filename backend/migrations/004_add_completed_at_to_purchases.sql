-- Add completed_at column to shop_rcn_purchases table
ALTER TABLE shop_rcn_purchases 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Update existing completed purchases to have a completed_at timestamp
UPDATE shop_rcn_purchases 
SET completed_at = created_at 
WHERE status = 'completed' AND completed_at IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_shop_rcn_purchases_completed_at 
ON shop_rcn_purchases(completed_at) 
WHERE completed_at IS NOT NULL;