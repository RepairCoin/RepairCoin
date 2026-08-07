-- Migration: 264_add_payments_location_and_tax.sql
-- Author: Nico Regalado
-- Date: 2026-08-05
-- Description: Make `payments` able to answer a revenue question on its own (POS S9c-1).
--
--   Two columns, both denormalised on purpose. Every shop analytics report filters by location and
--   reports revenue net of tax, and reaching either through a join means every one of those reports
--   carries two outer joins (order_id -> service_orders, pos_sale_id -> pos_sales) to produce a
--   single number. The ledger is the one place revenue is read from now; it has to stand alone.
--
--   `tax_cents` is the tax contained WITHIN gross_cents, not an addition to it. Sales tax is
--   collected for the state and was never the shop's money, so revenue is gross - tax - refunded.
--   Bookings carry no tax at all and leave it 0, which is why a counter sale and an identical
--   booking would otherwise differ by the local tax rate for no business reason.
--
--   On a split-tender sale the tax belongs to the sale, not to any one tender, so it is apportioned
--   across the fiat tenders pro rata with the rounding remainder on the largest leg — the sale's
--   tax and the sum of its ledger rows' tax then agree exactly.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 264) THEN

        ALTER TABLE payments
          ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS tax_cents   INTEGER NOT NULL DEFAULT 0;

        CREATE INDEX IF NOT EXISTS idx_payments_location
          ON payments (shop_id, location_id, created_at DESC) WHERE location_id IS NOT NULL;

        -- Backfill from the rows that already know: counter sales via the sale, bookings via the
        -- order. Tax only comes from POS — no booking has ever charged any.
        UPDATE payments p
        SET location_id = s.location_id
        FROM pos_sales s
        WHERE p.pos_sale_id = s.id AND p.location_id IS NULL AND s.location_id IS NOT NULL;

        UPDATE payments p
        SET location_id = o.location_id
        FROM service_orders o
        WHERE p.order_id = o.order_id AND p.location_id IS NULL AND o.location_id IS NOT NULL;

        -- Pro-rata share of the sale's tax, remainder to the largest tender so the legs sum exactly.
        WITH fiat AS (
          SELECT p.id, p.pos_sale_id, p.gross_cents, s.tax_cents AS sale_tax,
                 SUM(p.gross_cents) OVER (PARTITION BY p.pos_sale_id) AS sale_fiat,
                 ROW_NUMBER() OVER (PARTITION BY p.pos_sale_id ORDER BY p.gross_cents DESC, p.id) AS rn
          FROM payments p
          JOIN pos_sales s ON s.id = p.pos_sale_id
          WHERE p.pos_sale_id IS NOT NULL AND s.tax_cents > 0
        ),
        shares AS (
          SELECT id, pos_sale_id, rn,
                 FLOOR(sale_tax::numeric * gross_cents / NULLIF(sale_fiat, 0))::int AS share,
                 sale_tax,
                 SUM(FLOOR(sale_tax::numeric * gross_cents / NULLIF(sale_fiat, 0))::int)
                   OVER (PARTITION BY pos_sale_id) AS allocated
          FROM fiat
        )
        UPDATE payments p
        SET tax_cents = sh.share + CASE WHEN sh.rn = 1 THEN sh.sale_tax - sh.allocated ELSE 0 END
        FROM shares sh
        WHERE p.id = sh.id;

        INSERT INTO schema_migrations (version, name) VALUES (264, 'add_payments_location_and_tax');
        RAISE NOTICE 'Migration 264 (add_payments_location_and_tax) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 264 (add_payments_location_and_tax) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_payments_location;
-- ALTER TABLE payments DROP COLUMN IF EXISTS tax_cents, DROP COLUMN IF EXISTS location_id;
-- DELETE FROM schema_migrations WHERE version = 264;
-- COMMIT;
