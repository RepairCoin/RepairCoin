-- Migration: 057_add_performance_indexes.sql
-- Description: Add indexes to improve query performance for slow endpoints
-- Issue: Long query times on cross-shop stats and shop listing endpoints
-- Created: 2026-01-07

-- ============================================
-- TRANSACTIONS TABLE INDEXES
-- Improves: GET /api/customers/cross-shop/stats/network
-- ============================================

-- Index on transaction type for filtering redemptions
CREATE INDEX IF NOT EXISTS idx_transactions_type
  ON transactions(type);

-- Index on transaction status for filtering confirmed transactions
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);

-- Composite index for common query pattern (type + status)
CREATE INDEX IF NOT EXISTS idx_transactions_type_status
  ON transactions(type, status);

-- Partial index for cross-shop redemptions (most specific, best performance)
CREATE INDEX IF NOT EXISTS idx_transactions_cross_shop_redemptions
  ON transactions(shop_id, amount, created_at)
  WHERE type = 'redeem'
    AND status = 'confirmed'
    AND metadata->>'redemptionType' = 'cross_shop';

-- Index on JSONB metadata for redemption type queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_redemption_type
  ON transactions((metadata->>'redemptionType'))
  WHERE metadata->>'redemptionType' IS NOT NULL;

-- ============================================
-- SHOPS TABLE INDEXES
-- Improves: GET /api/customers/shops
-- ============================================

-- Composite index for active + verified shop queries
CREATE INDEX IF NOT EXISTS idx_shops_active_verified
  ON shops(active, verified);

-- Partial index for active verified shops (most efficient for customer queries)
CREATE INDEX IF NOT EXISTS idx_shops_active_verified_partial
  ON shops(shop_id, name, verified, active)
  WHERE active = true AND verified = true;

-- ============================================
-- CUSTOMERS TABLE INDEXES (for concurrent profile requests)
-- Improves: GET /api/customers/:address
-- ============================================

-- Index on wallet address for faster lookups (if not already primary key)
CREATE INDEX IF NOT EXISTS idx_customers_wallet_address
  ON customers(wallet_address);

-- Composite index for common customer queries
CREATE INDEX IF NOT EXISTS idx_customers_wallet_tier
  ON customers(wallet_address, tier);

-- ============================================
-- VERIFICATION
-- ============================================

-- Log index creation
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes created successfully';
  RAISE NOTICE 'Indexes added:';
  RAISE NOTICE '  - idx_transactions_type';
  RAISE NOTICE '  - idx_transactions_status';
  RAISE NOTICE '  - idx_transactions_type_status';
  RAISE NOTICE '  - idx_transactions_cross_shop_redemptions (partial)';
  RAISE NOTICE '  - idx_transactions_metadata_redemption_type';
  RAISE NOTICE '  - idx_shops_active_verified';
  RAISE NOTICE '  - idx_shops_active_verified_partial';
  RAISE NOTICE '  - idx_customers_wallet_address';
  RAISE NOTICE '  - idx_customers_wallet_tier';
END $$;
