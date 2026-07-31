-- Migration: 250_create_refunds.sql
-- Author: Nico Regalado
-- Date: 2026-07-29
-- Description: Refund records for the Payments Center (Slice 1.3). One row per refund
--   ISSUED FROM FIXFLOW, capturing who did it and why — neither of which Stripe knows.
--   This does NOT own refund totals: `payments.refunded_cents` and the payment status stay
--   owned by the webhook reconciler (charge.refunded), which is authoritative because a
--   refund can also be issued from the Stripe dashboard and would never appear here.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 250) THEN

        CREATE TABLE IF NOT EXISTS refunds (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_id       UUID         NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
          shop_id          VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          amount_cents     INTEGER      NOT NULL CHECK (amount_cents > 0),
          currency         CHAR(3)      NOT NULL DEFAULT 'usd',
          reason           VARCHAR(40)  NOT NULL,   -- requested_by_customer | duplicate | fraudulent
          note             TEXT,                    -- free-text context from the shop
          status           VARCHAR(24)  NOT NULL,   -- pending | succeeded | failed
          stripe_refund_id VARCHAR(255),
          created_by       VARCHAR(100),            -- wallet address of the user who issued it
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds (payment_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_refunds_shop    ON refunds (shop_id, created_at DESC);

        -- Closes the loop with the reconciler: charge.refunded carries the Stripe refund id,
        -- so the webhook can find the row this side created. Partial index because the id is
        -- absent for the moment between insert and the Stripe call returning.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_stripe_id
          ON refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

        INSERT INTO schema_migrations (version, name) VALUES (250, 'create_refunds');
        RAISE NOTICE 'Migration 250 (create_refunds) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 250 (create_refunds) already applied';
    END IF;
END $$;
