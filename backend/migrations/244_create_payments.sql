-- Migration: 244_create_payments.sql
-- Author: Nico Regalado
-- Date: 2026-07-27
-- Description: Unified FIAT payments ledger (Payments & Invoicing Center, Phase 0). One row
--   per money movement, reconciled from Stripe webhooks. Money is stored in INTEGER CENTS
--   (not the legacy DECIMAL dollars) to match Stripe and avoid rounding. This is the fiat
--   ledger — distinct from `transactions`, which is the RCN token ledger.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 244) THEN

        CREATE TABLE IF NOT EXISTS payments (
          id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id                  VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          customer_address         VARCHAR(100),
          order_id                 VARCHAR(100),            -- service_orders.order_id ("ord_…")
          invoice_id               UUID,                    -- FK wired in Phase 1 (invoices table)
          method                   VARCHAR(20)  NOT NULL,   -- card | cash | ach | deposit | terminal | link
          source                   VARCHAR(30)  NOT NULL,   -- booking | invoice | terminal | link | rcn_purchase | deposit
          gross_cents              INTEGER      NOT NULL,
          fee_cents                INTEGER      NOT NULL DEFAULT 0,   -- Stripe processing fee (balance txn)
          application_fee_cents    INTEGER      NOT NULL DEFAULT 0,   -- platform fee taken (0 = pass-through)
          net_cents                INTEGER      NOT NULL DEFAULT 0,   -- settles to the shop
          refunded_cents           INTEGER      NOT NULL DEFAULT 0,
          currency                 CHAR(3)      NOT NULL DEFAULT 'usd',
          status                   VARCHAR(24)  NOT NULL,   -- requires_payment | processing | succeeded | failed | refunded | partially_refunded
          stripe_payment_intent_id VARCHAR(255),
          stripe_charge_id         VARCHAR(255),
          stripe_account_id        VARCHAR(255),            -- connected account the charge lives on
          captured_at              TIMESTAMPTZ,
          metadata                 JSONB        NOT NULL DEFAULT '{}',
          created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_payments_shop     ON payments (shop_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (shop_id, customer_address);
        CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments (order_id);

        -- Natural idempotency for webhook reconcile: at most one payment row per PaymentIntent.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_intent
          ON payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

        INSERT INTO schema_migrations (version, name) VALUES (244, 'create_payments');
        RAISE NOTICE 'Migration 244 (create_payments) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 244 (create_payments) already applied';
    END IF;
END $$;
