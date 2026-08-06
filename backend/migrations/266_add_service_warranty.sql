-- Migration: 266_add_service_warranty.sql
-- Author: Nico Regalado
-- Date: 2026-08-06
-- Description: Record how long a repair is covered for, so a claim can be settled from the record.
--
--   A shop's warranty on its own labour is its liability and the customer's promise, and nothing
--   held it. When someone came back with the same fault there was no way to tell a warranty claim
--   from a new sale — not from the order, not from the sale, not from the customer's history.
--
--   Three columns, one meaning. `shop_services.warranty_days` is the shop's CURRENT terms, editable
--   at any time. The two snapshot columns are what was promised on the day, copied at the moment the
--   work was delivered, because terms move and a join at read time would silently rewrite a promise
--   made months ago — the same reason `pos_sale_items.unit_cost_cents` is snapshotted.
--
--   NULL or 0 both mean not covered. The distinction `unit_cost_cents` draws between "unknown" and
--   "zero" has no analogue here: a warranty nobody stated and a warranty of no days are the same
--   promise.
--
--   No expiry column. The clock starts when the work is delivered, so coverage is
--   `completed_at + warranty_days`, derivable wherever both are already in hand. Storing it as well
--   would give a completion date that could be corrected and an expiry that silently wasn't.
--
--   Deliberately NOT a device model. This records the term, not what it was performed on — the POS
--   plan's S7 is still greenfield.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 266) THEN

        ALTER TABLE shop_services   ADD COLUMN IF NOT EXISTS warranty_days INTEGER;
        ALTER TABLE pos_sale_items  ADD COLUMN IF NOT EXISTS warranty_days INTEGER;
        ALTER TABLE service_orders  ADD COLUMN IF NOT EXISTS warranty_days INTEGER;

        COMMENT ON COLUMN shop_services.warranty_days IS
          'Shop''s current warranty term in days for this service. NULL or 0 = not covered.';
        COMMENT ON COLUMN pos_sale_items.warranty_days IS
          'Warranty term snapshotted at ring-up. Coverage runs from pos_sales.completed_at.';
        COMMENT ON COLUMN service_orders.warranty_days IS
          'Warranty term snapshotted at completion. Coverage runs from completed_at.';

        -- The register looks these up by customer, so that filter is what needs the index. Existing
        -- rows are left NULL: no warranty was promised on work delivered before the shop could state
        -- one, and backfilling a term nobody agreed to would invent coverage.
        CREATE INDEX IF NOT EXISTS idx_service_orders_warranty
          ON service_orders (customer_address, completed_at DESC)
          WHERE warranty_days > 0 AND completed_at IS NOT NULL;

        INSERT INTO schema_migrations (version, name) VALUES (266, 'add_service_warranty');
        RAISE NOTICE 'Migration 266 (add_service_warranty) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 266 (add_service_warranty) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_service_orders_warranty;
-- ALTER TABLE service_orders  DROP COLUMN IF EXISTS warranty_days;
-- ALTER TABLE pos_sale_items  DROP COLUMN IF EXISTS warranty_days;
-- ALTER TABLE shop_services   DROP COLUMN IF EXISTS warranty_days;
-- DELETE FROM schema_migrations WHERE version = 266;
-- COMMIT;
