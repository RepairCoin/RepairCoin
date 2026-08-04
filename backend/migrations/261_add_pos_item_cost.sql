-- Migration: 261_add_pos_item_cost.sql
-- Author: Nico Regalado
-- Date: 2026-08-04
-- Description: Snapshot the cost of goods on each POS line (POS S5). Cost is captured at the
--   moment the line is rung up because it is unrecoverable afterwards: `inventory_items.cost`
--   moves every time a shop receives a purchase order at a new price, so joining it at read
--   time would silently rewrite last month's margin. Same reasoning as the existing name and
--   unit_price snapshots on this table.
--
--   NULL means "cost not known" and is deliberately distinct from 0, which means "genuinely
--   free". Custom lines, products with no cost recorded, and services with no linked parts all
--   land as NULL so margin reporting can exclude them instead of reporting 100% margin.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 261) THEN

        ALTER TABLE pos_sale_items
          ADD COLUMN IF NOT EXISTS unit_cost_cents INTEGER;

        COMMENT ON COLUMN pos_sale_items.unit_cost_cents IS
          'Cost of one unit at the time of sale. NULL = unknown, which is not the same as 0.';

        INSERT INTO schema_migrations (version, name) VALUES (261, 'add_pos_item_cost');
        RAISE NOTICE 'Migration 261 (add_pos_item_cost) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 261 (add_pos_item_cost) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- ALTER TABLE pos_sale_items DROP COLUMN IF EXISTS unit_cost_cents;
-- DELETE FROM schema_migrations WHERE version = 261;
-- COMMIT;
