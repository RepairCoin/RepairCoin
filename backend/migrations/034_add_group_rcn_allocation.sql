-- Migration: Add RCN allocation tracking for affiliate shop groups
-- Description: Allows shops to allocate their RCN balance to specific groups,
--              making it clear how much RCN backing is available per group

-- Create table to track shop's RCN allocation to each group
CREATE TABLE IF NOT EXISTS shop_group_rcn_allocations (
  shop_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100) NOT NULL,
  allocated_rcn NUMERIC(20, 8) NOT NULL DEFAULT 0,
  used_rcn NUMERIC(20, 8) NOT NULL DEFAULT 0, -- RCN currently backing issued tokens
  available_rcn NUMERIC(20, 8) GENERATED ALWAYS AS (allocated_rcn - used_rcn) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (shop_id, group_id),
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES affiliate_shop_groups(group_id) ON DELETE CASCADE,

  -- Constraints
  CHECK (allocated_rcn >= 0),
  CHECK (used_rcn >= 0),
  CHECK (used_rcn <= allocated_rcn)
);

-- Create indexes for faster queries
CREATE INDEX idx_shop_group_allocations_shop ON shop_group_rcn_allocations(shop_id);
CREATE INDEX idx_shop_group_allocations_group ON shop_group_rcn_allocations(group_id);

-- Add comments for documentation
COMMENT ON TABLE shop_group_rcn_allocations IS 'Tracks how much RCN each shop has allocated to each group for backing group tokens';
COMMENT ON COLUMN shop_group_rcn_allocations.allocated_rcn IS 'Total RCN the shop has allocated to this group';
COMMENT ON COLUMN shop_group_rcn_allocations.used_rcn IS 'RCN currently being used to back issued group tokens (at 1:2 ratio)';
COMMENT ON COLUMN shop_group_rcn_allocations.available_rcn IS 'RCN available for issuing new group tokens (computed: allocated - used)';
