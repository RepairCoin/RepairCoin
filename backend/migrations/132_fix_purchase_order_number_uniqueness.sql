-- Migration 132: Fix purchase order number uniqueness (per-shop, not global)
-- Description: PO numbers are generated per-shop (PO-YYYY-#### scoped to each shop),
--              but the column was declared globally UNIQUE. This caused a 500 when a
--              second shop generated a PO number already used by another shop
--              (e.g. every shop's first PO of the year is PO-YYYY-0001).
--
--              Fix: replace the global UNIQUE(po_number) with a composite
--              UNIQUE(shop_id, po_number) so each shop has its own PO sequence.

-- Drop the global unique constraint (auto-named when po_number was declared UNIQUE).
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;

-- Add per-shop uniqueness so each shop can independently use PO-YYYY-0001, 0002, ...
-- Guarded so the migration is idempotent (safe to re-run via single-file runner + db:migrate).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_shop_po_number'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT unique_shop_po_number UNIQUE (shop_id, po_number);
  END IF;
END $$;

COMMENT ON CONSTRAINT unique_shop_po_number ON purchase_orders
  IS 'PO numbers are unique per shop, not globally (each shop has its own PO-YYYY-#### sequence)';

DO $$
BEGIN
  RAISE NOTICE 'Migration 132: purchase_orders po_number uniqueness is now per-shop (shop_id, po_number)';
END $$;
