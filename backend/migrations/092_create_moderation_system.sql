-- Migration: Create moderation system tables
-- Description: Add support for customer blocking, issue reporting, and review moderation
-- Date: 2026-03-19

-- ==================== BLOCKED CUSTOMERS TABLE ====================

CREATE TABLE IF NOT EXISTS blocked_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_wallet_address TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_by TEXT NOT NULL,
  unblocked_at TIMESTAMPTZ,
  unblocked_by TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_shop_customer_block UNIQUE (shop_id, customer_wallet_address, is_active)
);

-- Add comments for documentation
COMMENT ON TABLE blocked_customers IS 'Customers blocked from booking services at specific shops';
COMMENT ON COLUMN blocked_customers.shop_id IS 'Shop that blocked the customer';
COMMENT ON COLUMN blocked_customers.customer_wallet_address IS 'Wallet address of blocked customer';
COMMENT ON COLUMN blocked_customers.reason IS 'Reason for blocking (e.g., multiple no-shows, abusive behavior)';
COMMENT ON COLUMN blocked_customers.is_active IS 'Whether the block is currently active';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_customers_shop_id ON blocked_customers(shop_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_customers_wallet ON blocked_customers(customer_wallet_address) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_customers_shop_wallet ON blocked_customers(shop_id, customer_wallet_address) WHERE is_active = true;

-- ==================== SHOP REPORTS TABLE ====================

CREATE TABLE IF NOT EXISTS shop_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('spam', 'fraud', 'inappropriate_review', 'harassment', 'other')),
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),

  -- Optional related entity
  related_entity_type TEXT CHECK (related_entity_type IN ('customer', 'review', 'order')),
  related_entity_id TEXT,

  -- Admin handling
  assigned_to TEXT,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_details TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add comments for documentation
COMMENT ON TABLE shop_reports IS 'Issue reports submitted by shops to platform admins';
COMMENT ON COLUMN shop_reports.category IS 'Type of issue being reported';
COMMENT ON COLUMN shop_reports.severity IS 'Impact level of the issue';
COMMENT ON COLUMN shop_reports.status IS 'Current status of the investigation';
COMMENT ON COLUMN shop_reports.related_entity_type IS 'Type of entity related to the report (customer/review/order)';
COMMENT ON COLUMN shop_reports.related_entity_id IS 'ID of the related entity';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_reports_shop_id ON shop_reports(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_reports_status ON shop_reports(status);
CREATE INDEX IF NOT EXISTS idx_shop_reports_severity ON shop_reports(severity);
CREATE INDEX IF NOT EXISTS idx_shop_reports_category ON shop_reports(category);
CREATE INDEX IF NOT EXISTS idx_shop_reports_created_at ON shop_reports(created_at DESC);

-- ==================== FLAGGED REVIEWS TABLE ====================

CREATE TABLE IF NOT EXISTS flagged_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),

  -- Admin handling
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,

  flagged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_review_flag UNIQUE (review_id, shop_id)
);

-- Add comments for documentation
COMMENT ON TABLE flagged_reviews IS 'Reviews flagged by shops for admin review';
COMMENT ON COLUMN flagged_reviews.review_id IS 'ID of the flagged review';
COMMENT ON COLUMN flagged_reviews.reason IS 'Reason for flagging the review';
COMMENT ON COLUMN flagged_reviews.status IS 'Current status of the flag (pending/approved/removed)';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_flagged_reviews_shop_id ON flagged_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_flagged_reviews_status ON flagged_reviews(status);
CREATE INDEX IF NOT EXISTS idx_flagged_reviews_review_id ON flagged_reviews(review_id);

-- ==================== AUTO-UPDATE TRIGGERS ====================

-- Trigger for blocked_customers
CREATE OR REPLACE FUNCTION update_blocked_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blocked_customers_updated_at ON blocked_customers;
CREATE TRIGGER blocked_customers_updated_at
  BEFORE UPDATE ON blocked_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_customers_updated_at();

-- Trigger for shop_reports
CREATE OR REPLACE FUNCTION update_shop_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shop_reports_updated_at ON shop_reports;
CREATE TRIGGER shop_reports_updated_at
  BEFORE UPDATE ON shop_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_reports_updated_at();

-- Trigger for flagged_reviews
CREATE OR REPLACE FUNCTION update_flagged_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS flagged_reviews_updated_at ON flagged_reviews;
CREATE TRIGGER flagged_reviews_updated_at
  BEFORE UPDATE ON flagged_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_flagged_reviews_updated_at();

-- Migration complete
