-- Migration 002: Add webhook logs, archiving, and system tables
-- Created: 2025-10-28
-- Purpose: Add infrastructure for webhook logging, transaction archiving, and system settings

-- ============================================================================
-- 1. WEBHOOK LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('stripe', 'fixflow', 'thirdweb', 'other')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'retry')),
  http_status INTEGER,
  payload JSONB NOT NULL,
  response JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry ON webhook_logs(status, retry_count) WHERE status = 'failed';

-- ============================================================================
-- 2. SYSTEM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- Index for system_settings
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- ============================================================================
-- 3. ARCHIVED TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS archived_transactions (
  id SERIAL PRIMARY KEY,
  original_transaction_id INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  amount DECIMAL(20, 2) NOT NULL,
  shop_id VARCHAR(255),
  customer_address VARCHAR(255),
  metadata JSONB,
  status VARCHAR(50),
  transaction_hash VARCHAR(255),
  block_number BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_reason TEXT
);

-- Indexes for archived_transactions
CREATE INDEX IF NOT EXISTS idx_archived_transactions_original_id ON archived_transactions(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_archived_transactions_type ON archived_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_archived_transactions_customer ON archived_transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_archived_transactions_shop ON archived_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_archived_transactions_created_at ON archived_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_transactions_archived_at ON archived_transactions(archived_at DESC);

-- ============================================================================
-- 4. PLATFORM STATISTICS MATERIALIZED VIEW
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_statistics AS
SELECT
  -- Token Statistics
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'mint' AND status = 'completed') AS total_rcn_minted,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'redeem' AND status = 'completed') AS total_rcn_redeemed,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'mint' AND status = 'completed') -
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type = 'redeem' AND status = 'completed') AS total_rcn_circulating,

  -- User Statistics
  (SELECT COUNT(*) FROM customers WHERE is_active = true) AS total_active_customers,
  (SELECT COUNT(*) FROM customers WHERE tier = 'Bronze' AND is_active = true) AS customers_bronze,
  (SELECT COUNT(*) FROM customers WHERE tier = 'Silver' AND is_active = true) AS customers_silver,
  (SELECT COUNT(*) FROM customers WHERE tier = 'Gold' AND is_active = true) AS customers_gold,

  -- Shop Statistics
  (SELECT COUNT(*) FROM shops WHERE active = true AND verified = true) AS total_active_shops,
  (SELECT COUNT(*) FROM shop_subscriptions WHERE status = 'active') AS shops_with_subscription,

  -- Revenue Statistics
  (SELECT COALESCE(SUM(amount), 0) FROM shop_rcn_purchases WHERE status = 'completed') AS total_revenue,
  (SELECT COALESCE(SUM(amount), 0) FROM shop_rcn_purchases
   WHERE status = 'completed'
   AND created_at >= NOW() - INTERVAL '30 days') AS revenue_last_30_days,

  -- Transaction Statistics
  (SELECT COUNT(*) FROM transactions WHERE status = 'completed') AS total_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours') AS transactions_last_24h,

  -- Referral Statistics
  (SELECT COUNT(*) FROM referrals WHERE status = 'completed') AS total_referrals,
  (SELECT COALESCE(SUM(referrer_reward + referee_reward), 0) FROM referrals WHERE status = 'completed') AS total_referral_rewards,

  -- Timestamp
  NOW() AS last_updated
;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_statistics_timestamp ON platform_statistics(last_updated);

-- ============================================================================
-- 5. WEBHOOK HEALTH CHECK FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_webhook_health()
RETURNS TABLE (
  source VARCHAR,
  total_count BIGINT,
  success_count BIGINT,
  failed_count BIGINT,
  retry_count BIGINT,
  avg_processing_time_ms NUMERIC,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wl.source,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE wl.status = 'success')::BIGINT AS success_count,
    COUNT(*) FILTER (WHERE wl.status = 'failed')::BIGINT AS failed_count,
    SUM(wl.retry_count)::BIGINT AS retry_count,
    AVG(EXTRACT(EPOCH FROM (wl.processed_at - wl.created_at)) * 1000)::NUMERIC AS avg_processing_time_ms,
    MAX(wl.processed_at) FILTER (WHERE wl.status = 'success') AS last_success_at,
    MAX(wl.created_at) FILTER (WHERE wl.status = 'failed') AS last_failure_at
  FROM webhook_logs wl
  WHERE wl.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY wl.source;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhook_logs_updated_at
  BEFORE UPDATE ON webhook_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. DATA RETENTION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM webhook_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status IN ('success', 'failed')
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TRANSACTION ARCHIVING FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION archive_old_transactions(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  WITH moved AS (
    INSERT INTO archived_transactions (
      original_transaction_id,
      transaction_type,
      from_address,
      to_address,
      amount,
      shop_id,
      customer_address,
      metadata,
      status,
      transaction_hash,
      block_number,
      created_at,
      archived_reason
    )
    SELECT
      id,
      transaction_type,
      from_address,
      to_address,
      amount,
      shop_id,
      customer_address,
      metadata,
      status,
      transaction_hash,
      block_number,
      created_at,
      'Automatic archival after ' || retention_days || ' days'
    FROM transactions
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status = 'completed'
    RETURNING original_transaction_id
  ),
  deleted AS (
    DELETE FROM transactions
    WHERE id IN (SELECT original_transaction_id FROM moved)
    RETURNING *
  )
  SELECT COUNT(*) INTO archived_count FROM deleted;

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. REFRESH STATISTICS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_platform_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. INITIAL DATA
-- ============================================================================

-- Insert default system settings
INSERT INTO system_settings (key, value, description, category, created_by)
VALUES
  ('webhook_retention_days', '90', 'Number of days to retain webhook logs', 'cleanup', 'system'),
  ('transaction_archive_days', '365', 'Number of days before archiving transactions', 'cleanup', 'system'),
  ('statistics_refresh_interval', '300', 'Seconds between statistics refresh (5 minutes)', 'performance', 'system'),
  ('enable_webhook_logging', 'true', 'Enable webhook event logging', 'webhooks', 'system'),
  ('webhook_retry_max_attempts', '3', 'Maximum retry attempts for failed webhooks', 'webhooks', 'system'),
  ('webhook_retry_delay_seconds', '60', 'Delay between webhook retries in seconds', 'webhooks', 'system')
ON CONFLICT (key) DO NOTHING;

-- Refresh statistics view
REFRESH MATERIALIZED VIEW platform_statistics;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
