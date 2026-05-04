-- Migration: Create inventory management tables
-- Description: Creates tables for inventory items, categories, vendors, and stock adjustments
-- Date: 2026-05-05

-- ============================================================================
-- 1. INVENTORY CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT unique_category_per_shop UNIQUE(shop_id, name)
);

CREATE INDEX idx_inventory_categories_shop_id ON inventory_categories(shop_id);
CREATE INDEX idx_inventory_categories_deleted_at ON inventory_categories(deleted_at);

COMMENT ON TABLE inventory_categories IS 'Product categories for inventory organization';
COMMENT ON COLUMN inventory_categories.display_order IS 'Order for displaying categories in UI';

-- ============================================================================
-- 2. INVENTORY VENDORS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  CONSTRAINT unique_vendor_per_shop UNIQUE(shop_id, name)
);

CREATE INDEX idx_inventory_vendors_shop_id ON inventory_vendors(shop_id);
CREATE INDEX idx_inventory_vendors_deleted_at ON inventory_vendors(deleted_at);

COMMENT ON TABLE inventory_vendors IS 'Suppliers and vendors for inventory items';

-- ============================================================================
-- 3. INVENTORY ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES inventory_vendors(id) ON DELETE SET NULL,

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  barcode VARCHAR(100),

  -- Pricing
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,

  -- Stock Management
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'available',

  -- Additional Data
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  -- Constraints
  CONSTRAINT check_stock_quantity CHECK (stock_quantity >= 0),
  CONSTRAINT check_reserved_quantity CHECK (reserved_quantity >= 0),
  CONSTRAINT check_reserved_not_exceed_stock CHECK (reserved_quantity <= stock_quantity),
  CONSTRAINT check_low_stock_threshold CHECK (low_stock_threshold >= 0),
  CONSTRAINT check_price_non_negative CHECK (price >= 0),
  CONSTRAINT check_cost_non_negative CHECK (cost >= 0),
  CONSTRAINT check_status_valid CHECK (status IN ('available', 'low_stock', 'out_of_stock', 'discontinued'))
);

-- Indexes for performance
CREATE INDEX idx_inventory_items_shop_id ON inventory_items(shop_id);
CREATE INDEX idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_vendor_id ON inventory_items(vendor_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_items_deleted_at ON inventory_items(deleted_at);
CREATE INDEX idx_inventory_items_name_search ON inventory_items USING gin(to_tsvector('english', name));

-- Unique constraint on SKU per shop
CREATE UNIQUE INDEX idx_inventory_items_shop_sku_unique
  ON inventory_items(shop_id, sku)
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

COMMENT ON TABLE inventory_items IS 'Inventory items managed by shops';
COMMENT ON COLUMN inventory_items.reserved_quantity IS 'Quantity reserved for pending orders/bookings';
COMMENT ON COLUMN inventory_items.status IS 'Current status: available, low_stock, out_of_stock, discontinued';
COMMENT ON COLUMN inventory_items.metadata IS 'Additional flexible data (unit, weight, dimensions, etc.)';

-- ============================================================================
-- 4. INVENTORY ADJUSTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Adjustment Details
  adjustment_type VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,

  -- Reference Information
  reference_type VARCHAR(50),
  reference_id VARCHAR(255),

  -- Metadata
  reason TEXT,
  notes TEXT,
  adjusted_by VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_adjustment_type_valid CHECK (adjustment_type IN ('manual', 'purchase', 'sale', 'return', 'damage', 'loss', 'recount', 'transfer'))
);

CREATE INDEX idx_inventory_adjustments_item_id ON inventory_adjustments(item_id);
CREATE INDEX idx_inventory_adjustments_shop_id ON inventory_adjustments(shop_id);
CREATE INDEX idx_inventory_adjustments_created_at ON inventory_adjustments(created_at DESC);
CREATE INDEX idx_inventory_adjustments_adjustment_type ON inventory_adjustments(adjustment_type);
CREATE INDEX idx_inventory_adjustments_reference ON inventory_adjustments(reference_type, reference_id);

COMMENT ON TABLE inventory_adjustments IS 'History of all inventory quantity changes';
COMMENT ON COLUMN inventory_adjustments.adjustment_type IS 'Type: manual, purchase, sale, return, damage, loss, recount, transfer';
COMMENT ON COLUMN inventory_adjustments.reference_type IS 'Optional reference (e.g., order, booking, purchase_order)';
COMMENT ON COLUMN inventory_adjustments.reference_id IS 'ID of the referenced entity';

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp on inventory_items
CREATE OR REPLACE FUNCTION update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger to update updated_at timestamp on inventory_categories
CREATE TRIGGER trigger_update_inventory_categories_updated_at
  BEFORE UPDATE ON inventory_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger to update updated_at timestamp on inventory_vendors
CREATE TRIGGER trigger_update_inventory_vendors_updated_at
  BEFORE UPDATE ON inventory_vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger to auto-update status based on stock quantity
CREATE OR REPLACE FUNCTION update_inventory_item_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_quantity = 0 THEN
    NEW.status = 'out_of_stock';
  ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
    NEW.status = 'low_stock';
  ELSIF NEW.status IN ('low_stock', 'out_of_stock') THEN
    -- Only auto-change status if it was previously low/out of stock
    NEW.status = 'available';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_item_status
  BEFORE INSERT OR UPDATE OF stock_quantity, low_stock_threshold ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_item_status();

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- View for inventory items with calculated available quantity
CREATE OR REPLACE VIEW inventory_items_with_availability AS
SELECT
  ii.*,
  (ii.stock_quantity - ii.reserved_quantity) AS available_quantity,
  ic.name AS category_name,
  iv.name AS vendor_name,
  CASE
    WHEN ii.stock_quantity = 0 THEN 'out_of_stock'
    WHEN ii.stock_quantity <= ii.low_stock_threshold THEN 'low_stock'
    ELSE 'available'
  END AS calculated_status
FROM inventory_items ii
LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
LEFT JOIN inventory_vendors iv ON ii.vendor_id = iv.id
WHERE ii.deleted_at IS NULL;

COMMENT ON VIEW inventory_items_with_availability IS 'Inventory items with calculated available quantity and joined category/vendor names';

-- ============================================================================
-- 7. GRANT PERMISSIONS (if using role-based access)
-- ============================================================================

-- Grant permissions to application user (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_categories TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_vendors TO app_user;
-- GRANT SELECT, INSERT ON inventory_adjustments TO app_user;
-- GRANT SELECT ON inventory_items_with_availability TO app_user;
