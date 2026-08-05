-- Migration: 263_add_payments_manual_order_key.sql
-- Author: Nico Regalado
-- Date: 2026-08-05
-- Description: Idempotency key for booking payments that never touch Stripe (POS S9b).
--
--   A booking settled outside Stripe — cash handed over at the counter via
--   POST /api/services/orders/:id/mark-paid — has no PaymentIntent and no POS tender, so neither
--   uq_payments_intent (244) nor uq_payments_pos_tender (262) can protect it. Without a key, a
--   double-tapped mark-paid or a re-run of the backfill writes a second ledger row and the shop's
--   revenue doubles.
--
--   The order is the natural key: a booking is settled in one movement, so at most one non-Stripe
--   ledger row may exist per order. The predicate excludes Stripe-backed rows deliberately — a card
--   booking that is refunded and re-charged legitimately produces two rows, each keyed by its own
--   PaymentIntent.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 263) THEN

        CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_manual_order
          ON payments (order_id)
          WHERE order_id IS NOT NULL AND stripe_payment_intent_id IS NULL;

        INSERT INTO schema_migrations (version, name) VALUES (263, 'add_payments_manual_order_key');
        RAISE NOTICE 'Migration 263 (add_payments_manual_order_key) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 263 (add_payments_manual_order_key) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS uq_payments_manual_order;
-- DELETE FROM schema_migrations WHERE version = 263;
-- COMMIT;
