-- Migration: Create Purchase Order Suggestions System
-- Description: Adds vendor lead times and PO suggestions table with smart analytics
-- Date: 2026-05-18
-- Version: v2.1 - Auto PO Suggestions

-- ============================================================================
-- 1. ADD LEAD TIME TO VENDORS TABLE
-- ============================================================================

ALTER TABLE inventory_vendors
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7;

COMMENT ON COLUMN inventory_vendors.lead_time_days IS 'Average number of days for vendor to deliver orders (default: 7 days)';

-- Add constraint to ensure lead time is reasonable (1-365 days)
ALTER TABLE inventory_vendors
  ADD CONSTRAINT check_lead_time_days CHECK (lead_time_days >= 1 AND lead_time_days <= 365);

-- ============================================================================
-- 2. PURCHASE ORDER SUGGESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES inventory_vendors(id) ON DELETE SET NULL,

  -- Suggestion Details
  suggested_quantity INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  avg_daily_usage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  days_until_stockout INTEGER,
  days_of_supply INTEGER, -- How many days the suggested quantity will last

  -- Urgency & Priority
  urgency VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  priority_score INTEGER DEFAULT 50, -- 0-100 score for sorting

  -- Explanation
  reason TEXT NOT NULL, -- Human-readable explanation

  -- Analytics Data
  estimated_stockout_date TIMESTAMP,
  reorder_point INTEGER, -- Calculated reorder point
  safety_stock INTEGER, -- Minimum safety stock recommendation

  -- Status & Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'ordered')),

  -- Action Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'), -- Auto-expire after 7 days
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  ordered_at TIMESTAMP,

  -- Action Details
  rejection_reason TEXT,
  approved_by VARCHAR(255),
  rejected_by VARCHAR(255),

  -- Purchase Order Link (when approved and converted to PO)
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT check_suggested_quantity_positive CHECK (suggested_quantity > 0),
  CONSTRAINT check_current_stock_non_negative CHECK (current_stock >= 0),
  CONSTRAINT check_avg_daily_usage_non_negative CHECK (avg_daily_usage >= 0),
  CONSTRAINT check_priority_score_range CHECK (priority_score >= 0 AND priority_score <= 100)
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_po_suggestions_shop_id ON purchase_order_suggestions(shop_id);
CREATE INDEX idx_po_suggestions_item_id ON purchase_order_suggestions(item_id);
CREATE INDEX idx_po_suggestions_vendor_id ON purchase_order_suggestions(vendor_id);
CREATE INDEX idx_po_suggestions_status ON purchase_order_suggestions(status);
CREATE INDEX idx_po_suggestions_urgency ON purchase_order_suggestions(urgency);
CREATE INDEX idx_po_suggestions_created_at ON purchase_order_suggestions(created_at DESC);
CREATE INDEX idx_po_suggestions_expires_at ON purchase_order_suggestions(expires_at);

-- Composite index for active suggestions per shop
CREATE INDEX idx_po_suggestions_active
  ON purchase_order_suggestions(shop_id, status, priority_score DESC)
  WHERE status = 'pending' AND expires_at > CURRENT_TIMESTAMP;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE purchase_order_suggestions IS 'AI-generated purchase order suggestions based on usage analytics';
COMMENT ON COLUMN purchase_order_suggestions.suggested_quantity IS 'Recommended quantity to order (typically 30-60 day supply)';
COMMENT ON COLUMN purchase_order_suggestions.avg_daily_usage IS 'Average daily usage over last 30 days';
COMMENT ON COLUMN purchase_order_suggestions.days_until_stockout IS 'Estimated days until item runs out at current usage rate';
COMMENT ON COLUMN purchase_order_suggestions.days_of_supply IS 'Number of days the suggested quantity will last';
COMMENT ON COLUMN purchase_order_suggestions.urgency IS 'Urgency level: low (>30 days), medium (15-30), high (7-15), critical (<7)';
COMMENT ON COLUMN purchase_order_suggestions.priority_score IS 'Overall priority score (0-100) for sorting suggestions';
COMMENT ON COLUMN purchase_order_suggestions.reason IS 'Human-readable explanation for the suggestion';
COMMENT ON COLUMN purchase_order_suggestions.reorder_point IS 'Calculated reorder point (lead time + safety stock)';
COMMENT ON COLUMN purchase_order_suggestions.safety_stock IS 'Recommended minimum safety stock level';
COMMENT ON COLUMN purchase_order_suggestions.expires_at IS 'Suggestion expires 7 days after creation';

-- ============================================================================
-- 5. MIGRATION TRACKING
-- ============================================================================

INSERT INTO migration_history (migration_number, migration_name, executed_at)
VALUES (116, 'create_po_suggestions_system', CURRENT_TIMESTAMP)
ON CONFLICT (migration_number) DO NOTHING;
