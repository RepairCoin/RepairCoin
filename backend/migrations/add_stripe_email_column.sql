-- Add email column to stripe_customers table
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add name column while we're at it (likely missing too)
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add metadata column for additional data
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email 
ON stripe_customers(email);

-- Update existing records with shop email if available
UPDATE stripe_customers sc
SET email = s.email,
    name = s.name
FROM shops s
WHERE sc.shop_id = s.shop_id
AND sc.email IS NULL;