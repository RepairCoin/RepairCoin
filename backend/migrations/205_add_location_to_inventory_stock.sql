-- 205 — Multi-location Slice 4a: per-location inventory stock.
-- inventory_items stays the shop-level catalog (name, sku, price, category, vendor, default
-- threshold); this table holds the per-branch quantities. inventory_items.stock_quantity /
-- reserved_quantity remain the cached shop-total (sum across locations), so every existing
-- shop-wide read (analytics, AI insights, low-stock alerts, PO suggestions, the availability view,
-- the status trigger) keeps working unchanged. Idempotent.

-- ==================== per-location stock ====================
CREATE TABLE IF NOT EXISTS inventory_item_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES shop_locations(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER, -- NULL = inherit inventory_items.low_stock_threshold
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_item_stock_item_location UNIQUE (item_id, location_id),
  CONSTRAINT check_ils_stock_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT check_ils_reserved_non_negative CHECK (reserved_quantity >= 0),
  CONSTRAINT check_ils_reserved_not_exceed_stock CHECK (reserved_quantity <= stock_quantity),
  CONSTRAINT check_ils_threshold_non_negative CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0)
);

CREATE INDEX IF NOT EXISTS idx_item_stock_item ON inventory_item_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_item_stock_location ON inventory_item_stock(location_id);

-- Reuse the updated_at trigger function created in migration 109.
DROP TRIGGER IF EXISTS trigger_update_inventory_item_stock_updated_at ON inventory_item_stock;
CREATE TRIGGER trigger_update_inventory_item_stock_updated_at
  BEFORE UPDATE ON inventory_item_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Per-branch adjustment ledger: which location the change hit (NULL = legacy / shop-level).
ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON inventory_adjustments(location_id);

-- Purchase orders receive stock into a branch (NULL = the shop's primary, resolved at receive time).
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_location ON purchase_orders(location_id);

-- ==================== backfill ====================
-- One stock row per live item at its shop's PRIMARY location, carrying today's quantities. Shops
-- with no primary location (shouldn't happen post-192) simply get no row and keep reading the total.
INSERT INTO inventory_item_stock (item_id, location_id, stock_quantity, reserved_quantity, low_stock_threshold)
SELECT ii.id, sl.id, ii.stock_quantity, ii.reserved_quantity, NULL
FROM inventory_items ii
JOIN shop_locations sl ON sl.shop_id = ii.shop_id AND sl.is_primary = true
WHERE ii.deleted_at IS NULL
ON CONFLICT (item_id, location_id) DO NOTHING;
