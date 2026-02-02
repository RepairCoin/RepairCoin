-- Hotfix: Add platform statistics to existing database
-- This bridges the old schema to support the new platform_statistics feature

-- Step 1: Update webhook_logs table to add missing columns if they don't exist
DO $$
BEGIN
    -- Add webhook_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'webhook_id') THEN
        ALTER TABLE webhook_logs ADD COLUMN webhook_id VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
    END IF;

    -- Add retry_count if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'retry_count') THEN
        ALTER TABLE webhook_logs ADD COLUMN retry_count INTEGER DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry ON webhook_logs(status, retry_count)
        WHERE status = 'failed';
    END IF;

    -- Add last_retry_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'last_retry_at') THEN
        ALTER TABLE webhook_logs ADD COLUMN last_retry_at TIMESTAMP;
    END IF;

    -- Add http_status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'http_status') THEN
        ALTER TABLE webhook_logs ADD COLUMN http_status INTEGER;
    END IF;

    -- Add response if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'response') THEN
        ALTER TABLE webhook_logs ADD COLUMN response JSONB;
    END IF;

    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'webhook_logs' AND column_name = 'updated_at') THEN
        ALTER TABLE webhook_logs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Step 2: Create platform_statistics materialized view
DROP MATERIALIZED VIEW IF EXISTS platform_statistics CASCADE;

CREATE MATERIALIZED VIEW platform_statistics AS
SELECT
  -- Token Statistics
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'mint') as total_rcn_minted,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'redeem') as total_rcn_redeemed,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'mint') -
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'redeem') as total_rcn_circulating,

  -- User Statistics
  (SELECT COUNT(DISTINCT wallet_address) FROM customers WHERE is_active = true) as total_active_customers,
  (SELECT COUNT(*) FROM customers WHERE tier = 'bronze' AND is_active = true) as customers_bronze,
  (SELECT COUNT(*) FROM customers WHERE tier = 'silver' AND is_active = true) as customers_silver,
  (SELECT COUNT(*) FROM customers WHERE tier = 'gold' AND is_active = true) as customers_gold,

  -- Shop Statistics
  (SELECT COUNT(*) FROM shops WHERE verified = true AND active = true) as total_active_shops,
  (SELECT COUNT(*) FROM shops WHERE active = true) as shops_with_subscription,

  -- Revenue Statistics (simplified - customize based on your revenue tracking)
  0 as total_revenue,
  0 as revenue_last_30_days,

  -- Transaction Statistics
  (SELECT COUNT(*) FROM transactions) as total_transactions,
  (SELECT COUNT(*) FROM transactions WHERE created_at >= NOW() - INTERVAL '24 hours') as transactions_last_24h,

  -- Referral Statistics
  (SELECT COUNT(*) FROM customers WHERE referred_by IS NOT NULL) as total_referrals,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'tier_bonus') as total_referral_rewards,

  -- Metadata
  NOW() as last_updated;

-- Step 3: Perform initial refresh (non-concurrent for first time)
REFRESH MATERIALIZED VIEW platform_statistics;

-- Create index for faster refresh (AFTER initial refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_statistics_singleton ON platform_statistics ((1));

-- Step 4: Create refresh function for future updates
CREATE OR REPLACE FUNCTION refresh_platform_statistics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Record this migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (1021, 'hotfix_platform_statistics', NOW())
ON CONFLICT (version) DO NOTHING;

SELECT 'Platform statistics hotfix applied successfully!' as result;
