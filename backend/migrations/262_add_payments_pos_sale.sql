-- Migration: 262_add_payments_pos_sale.sql
-- Author: Nico Regalado
-- Date: 2026-08-04
-- Description: Link the fiat `payments` ledger to counter sales (POS S6a). Until now POS card
--   sales reached the ledger only as a side effect of the Stripe webhook — with no customer, no
--   sale reference, and mislabelled `source = 'booking'` — and cash sales never reached it at
--   all, because there is no Stripe object for the reconciler to see. The ledger under-reported
--   revenue for any shop using the POS.
--
--   `pos_sale_payment_id` is the idempotency key for tenders that have no PaymentIntent. Card
--   legs are already protected by uq_payments_intent (244); cash legs have nothing else unique
--   about them, and a retried completion would otherwise duplicate the row.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 262) THEN

        ALTER TABLE payments
          ADD COLUMN IF NOT EXISTS pos_sale_id         UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS pos_sale_payment_id UUID REFERENCES pos_sale_payments(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_payments_pos_sale
          ON payments (pos_sale_id) WHERE pos_sale_id IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_pos_tender
          ON payments (pos_sale_payment_id) WHERE pos_sale_payment_id IS NOT NULL;

        INSERT INTO schema_migrations (version, name) VALUES (262, 'add_payments_pos_sale');
        RAISE NOTICE 'Migration 262 (add_payments_pos_sale) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 262 (add_payments_pos_sale) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS uq_payments_pos_tender;
-- DROP INDEX IF EXISTS idx_payments_pos_sale;
-- ALTER TABLE payments DROP COLUMN IF EXISTS pos_sale_payment_id;
-- ALTER TABLE payments DROP COLUMN IF EXISTS pos_sale_id;
-- DELETE FROM schema_migrations WHERE version = 262;
-- COMMIT;
