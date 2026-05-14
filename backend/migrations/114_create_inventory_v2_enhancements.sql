-- Migration: Create Inventory v2.0 Enhancement Tables
-- Description: Creates tables for service-inventory integration, purchase orders, and alert settings
-- Date: 2026-05-14
-- Related: Inventory v2.0 features (service integration, purchase orders, low stock alerts)

-- ============================================================================
-- 1. SERVICE-INVENTORY INTEGRATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_required INTEGER NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_quantity_required_positive CHECK (quantity_required > 0),
  CONSTRAINT unique_service_item_link UNIQUE(service_id, inventory_item_id)
);

-- Indexes
CREATE INDEX idx_service_inventory_items_service_id ON service_inventory_items(service_id);
CREATE INDEX idx_service_inventory_items_shop_id ON service_inventory_items(shop_id);
CREATE INDEX idx_service_inventory_items_inventory_item_id ON service_inventory_items(inventory_item_id);

COMMENT ON TABLE service_inventory_items IS 'Links inventory items to services for automatic stock deduction';
COMMENT ON COLUMN service_inventory_items.quantity_required IS 'Number of units required per service completion';
COMMENT ON COLUMN service_inventory_items.is_optional IS 'If true, item is optional and wont block service if out of stock';

-- ============================================================================
-- 2. PURCHASE ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES inventory_vendors(id) ON DELETE SET NULL,
  vendor_name VARCHAR(255),

  -- Dates
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  received_date DATE,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',

  -- Costs
  subtotal DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  shipping DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,

  -- Additional Info
  notes TEXT,
  tracking_number VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  -- Constraints
  CONSTRAINT check_po_status_valid CHECK (status IN ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled')),
  CONSTRAINT check_po_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT check_po_tax_non_negative CHECK (tax >= 0),
  CONSTRAINT check_po_shipping_non_negative CHECK (shipping >= 0),
  CONSTRAINT check_po_total_non_negative CHECK (total >= 0)
);

-- Indexes
CREATE INDEX idx_purchase_orders_shop_id ON purchase_orders(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);

COMMENT ON TABLE purchase_orders IS 'Purchase orders for inventory restocking';
COMMENT ON COLUMN purchase_orders.po_number IS 'Auto-generated PO number (format: PO-YYYY-####)';
COMMENT ON COLUMN purchase_orders.status IS 'Workflow: draft → sent → confirmed → partially_received → received | cancelled';

-- ============================================================================
-- 3. PURCHASE ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

  -- Item Details (denormalized for history)
  item_name VARCHAR(255) NOT NULL,
  item_sku VARCHAR(100),

  -- Quantities
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,

  -- Costs
  unit_cost DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_poi_quantity_ordered_positive CHECK (quantity_ordered > 0),
  CONSTRAINT check_poi_quantity_received_non_negative CHECK (quantity_received >= 0),
  CONSTRAINT check_poi_quantity_received_not_exceed CHECK (quantity_received <= quantity_ordered),
  CONSTRAINT check_poi_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT check_poi_line_total_non_negative CHECK (line_total >= 0)
);

-- Indexes
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(po_id);
CREATE INDEX idx_purchase_order_items_inventory_item_id ON purchase_order_items(inventory_item_id);

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Quantity received so far (supports partial receiving)';

-- ============================================================================
-- 4. ADD ALERT SETTINGS COLUMNS TO SHOPS TABLE
-- ============================================================================
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS low_stock_alerts_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS low_stock_alert_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS low_stock_alert_frequency VARCHAR(20) DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS last_low_stock_alert_sent TIMESTAMP;

COMMENT ON COLUMN shops.low_stock_alerts_enabled IS 'Enable/disable low stock email alerts';
COMMENT ON COLUMN shops.low_stock_alert_email IS 'Custom email for low stock alerts (defaults to shop email)';
COMMENT ON COLUMN shops.low_stock_alert_frequency IS 'Alert frequency: daily or weekly';
COMMENT ON COLUMN shops.last_low_stock_alert_sent IS 'Timestamp of last alert sent (for cooldown)';

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on service_inventory_items
CREATE TRIGGER trigger_update_service_inventory_items_updated_at
  BEFORE UPDATE ON service_inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger to update updated_at on purchase_orders
CREATE TRIGGER trigger_update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger to update updated_at on purchase_order_items
CREATE TRIGGER trigger_update_purchase_order_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index for common service-inventory queries
CREATE INDEX idx_service_inventory_items_service_shop ON service_inventory_items(service_id, shop_id);

-- Index for finding low stock items that need alerts
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(shop_id, stock_quantity, low_stock_threshold)
  WHERE status IN ('low_stock', 'out_of_stock') AND deleted_at IS NULL;

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to application user (if using role-based access)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON service_inventory_items TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO app_user;
