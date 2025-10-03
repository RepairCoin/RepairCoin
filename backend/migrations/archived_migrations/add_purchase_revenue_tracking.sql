-- Add revenue distribution columns to shop_rcn_purchases table
ALTER TABLE shop_rcn_purchases
ADD COLUMN IF NOT EXISTS shop_tier VARCHAR(20) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS operations_share NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS stakers_share NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS dao_treasury_share NUMERIC(18,2);

-- Create index for revenue reporting
CREATE INDEX IF NOT EXISTS idx_shop_purchases_revenue_date ON shop_rcn_purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_shop_tier ON shop_rcn_purchases(shop_tier);

-- Create weekly revenue aggregation view
CREATE OR REPLACE VIEW weekly_revenue_summary AS
SELECT 
  DATE_TRUNC('week', created_at) AS week_start,
  DATE_TRUNC('week', created_at) + INTERVAL '6 days' AS week_end,
  COUNT(*) AS total_purchases,
  SUM(amount) AS total_rcn_sold,
  SUM(total_cost) AS total_revenue,
  SUM(operations_share) AS total_operations,
  SUM(stakers_share) AS total_stakers,
  SUM(dao_treasury_share) AS total_dao,
  -- Breakdown by tier
  SUM(CASE WHEN shop_tier = 'standard' THEN amount ELSE 0 END) AS standard_rcn_sold,
  SUM(CASE WHEN shop_tier = 'premium' THEN amount ELSE 0 END) AS premium_rcn_sold,
  SUM(CASE WHEN shop_tier = 'elite' THEN amount ELSE 0 END) AS elite_rcn_sold,
  SUM(CASE WHEN shop_tier = 'standard' THEN total_cost ELSE 0 END) AS standard_revenue,
  SUM(CASE WHEN shop_tier = 'premium' THEN total_cost ELSE 0 END) AS premium_revenue,
  SUM(CASE WHEN shop_tier = 'elite' THEN total_cost ELSE 0 END) AS elite_revenue
FROM shop_rcn_purchases
WHERE status = 'completed'
GROUP BY DATE_TRUNC('week', created_at);

-- Create function to calculate and update revenue distribution for a purchase
CREATE OR REPLACE FUNCTION calculate_purchase_revenue_distribution()
RETURNS TRIGGER AS $$
DECLARE
  operations_pct CONSTANT NUMERIC := 0.80;
  stakers_pct CONSTANT NUMERIC := 0.10;
  dao_pct CONSTANT NUMERIC := 0.10;
BEGIN
  -- Only calculate for completed purchases
  IF NEW.status = 'completed' THEN
    -- Get shop tier
    SELECT rcg_tier INTO NEW.shop_tier 
    FROM shops 
    WHERE shop_id = NEW.shop_id;
    
    -- Set unit price based on tier
    CASE NEW.shop_tier
      WHEN 'elite' THEN NEW.unit_price := 0.06;
      WHEN 'premium' THEN NEW.unit_price := 0.08;
      ELSE NEW.unit_price := 0.10; -- standard or none
    END CASE;
    
    -- Calculate revenue shares
    NEW.operations_share := ROUND(NEW.total_cost * operations_pct, 2);
    NEW.stakers_share := ROUND(NEW.total_cost * stakers_pct, 2);
    NEW.dao_treasury_share := ROUND(NEW.total_cost * dao_pct, 2);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new purchases
DROP TRIGGER IF EXISTS calculate_revenue_on_purchase ON shop_rcn_purchases;
CREATE TRIGGER calculate_revenue_on_purchase
BEFORE INSERT OR UPDATE OF status ON shop_rcn_purchases
FOR EACH ROW
EXECUTE FUNCTION calculate_purchase_revenue_distribution();

-- Update existing completed purchases with revenue distribution
UPDATE shop_rcn_purchases p
SET 
  shop_tier = COALESCE(s.rcg_tier, 'standard'),
  unit_price = CASE 
    WHEN s.rcg_tier = 'elite' THEN 0.06
    WHEN s.rcg_tier = 'premium' THEN 0.08
    ELSE 0.10
  END,
  operations_share = ROUND(p.total_cost * 0.80, 2),
  stakers_share = ROUND(p.total_cost * 0.10, 2),
  dao_treasury_share = ROUND(p.total_cost * 0.10, 2)
FROM shops s
WHERE p.shop_id = s.shop_id
AND p.status = 'completed'
AND p.operations_share IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN shop_rcn_purchases.shop_tier IS 'Shop tier at time of purchase for revenue calculation';
COMMENT ON COLUMN shop_rcn_purchases.unit_price IS 'Price per RCN based on shop tier';
COMMENT ON COLUMN shop_rcn_purchases.operations_share IS '80% of revenue for operations';
COMMENT ON COLUMN shop_rcn_purchases.stakers_share IS '10% of revenue for RCG stakers';
COMMENT ON COLUMN shop_rcn_purchases.dao_treasury_share IS '10% of revenue for DAO treasury';

COMMENT ON VIEW weekly_revenue_summary IS 'Weekly aggregated revenue data for distribution to stakers and DAO';