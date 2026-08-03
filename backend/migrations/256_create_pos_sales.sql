-- Migration: 256_create_pos_sales.sql
-- Author: Nico Regalado
-- Date: 2026-08-03
-- Description: Multi-line point-of-sale model (POS S2). service_orders is one order = one
--   service, which cannot hold a counter sale: several lines, mixed services and products,
--   discounts, tax, and a total settled across more than one tender. Money is INTEGER CENTS
--   throughout, matching `payments` (244) rather than the legacy DECIMAL dollars.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 256) THEN

        CREATE TABLE IF NOT EXISTS pos_sales (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id            VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          location_id        UUID REFERENCES shop_locations(id) ON DELETE SET NULL,
          -- Walk-in trade is the norm at a counter, so a sale never requires a customer. Set it
          -- and the sale earns loyalty and lands in that customer's history; leave it null and
          -- the sale is still complete and valid.
          customer_address   VARCHAR(100),
          staff_member_id    UUID,
          sale_number        BIGINT,
          status             VARCHAR(20)  NOT NULL DEFAULT 'open',
          subtotal_cents     INTEGER      NOT NULL DEFAULT 0,
          discount_cents     INTEGER      NOT NULL DEFAULT 0,
          tax_cents          INTEGER      NOT NULL DEFAULT 0,
          total_cents        INTEGER      NOT NULL DEFAULT 0,
          currency           CHAR(3)      NOT NULL DEFAULT 'usd',
          note               TEXT,
          completed_at       TIMESTAMPTZ,
          voided_at          TIMESTAMPTZ,
          void_reason        TEXT,
          metadata           JSONB        NOT NULL DEFAULT '{}',
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT pos_sales_status_check
            CHECK (status IN ('open', 'completed', 'voided', 'refunded', 'partially_refunded'))
        );

        CREATE INDEX IF NOT EXISTS idx_pos_sales_shop     ON pos_sales (shop_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pos_sales_customer ON pos_sales (shop_id, customer_address);
        CREATE INDEX IF NOT EXISTS idx_pos_sales_open     ON pos_sales (shop_id) WHERE status = 'open';

        -- Human-facing receipt number, per shop. Assigned on completion, so abandoned carts
        -- don't burn numbers and the sequence a shop shows customers has no gaps.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sales_number
          ON pos_sales (shop_id, sale_number) WHERE sale_number IS NOT NULL;

        CREATE TABLE IF NOT EXISTS pos_sale_items (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sale_id            UUID         NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
          line_number        INTEGER      NOT NULL,
          kind               VARCHAR(16)  NOT NULL,
          service_id         VARCHAR(100),
          inventory_item_id  UUID,
          -- Name and unit price are SNAPSHOTS, never joined at read time: a shop editing a price
          -- or renaming a service must not rewrite what last month's receipt says it sold.
          name               TEXT         NOT NULL,
          quantity           INTEGER      NOT NULL DEFAULT 1,
          unit_price_cents   INTEGER      NOT NULL,
          discount_cents     INTEGER      NOT NULL DEFAULT 0,
          taxable            BOOLEAN      NOT NULL DEFAULT true,
          tax_rate_bps       INTEGER      NOT NULL DEFAULT 0,
          tax_cents          INTEGER      NOT NULL DEFAULT 0,
          total_cents        INTEGER      NOT NULL,
          metadata           JSONB        NOT NULL DEFAULT '{}',
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT pos_sale_items_kind_check CHECK (kind IN ('service', 'product', 'custom')),
          CONSTRAINT pos_sale_items_quantity_check CHECK (quantity > 0),
          -- A line must identify what it sold, or be explicitly ad-hoc. Without this, a caller
          -- omitting the reference silently produces a line no downstream consumer can act on:
          -- no stock to deduct, no service to attribute.
          CONSTRAINT pos_sale_items_ref_check CHECK (
            (kind = 'service' AND service_id IS NOT NULL) OR
            (kind = 'product' AND inventory_item_id IS NOT NULL) OR
            (kind = 'custom')
          )
        );

        CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items (sale_id, line_number);
        CREATE INDEX IF NOT EXISTS idx_pos_sale_items_item ON pos_sale_items (inventory_item_id)
          WHERE inventory_item_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS pos_sale_payments (
          id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sale_id                  UUID         NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
          method                   VARCHAR(16)  NOT NULL,
          amount_cents             INTEGER      NOT NULL,
          -- Cash drawer arithmetic, held per tender: a split sale can take cash for only part of
          -- the total, and the change given belongs to that leg rather than to the sale.
          tendered_cents           INTEGER,
          change_cents             INTEGER,
          status                   VARCHAR(24)  NOT NULL DEFAULT 'pending',
          stripe_payment_intent_id VARCHAR(255),
          stripe_reader_id         VARCHAR(255),
          application_fee_cents    INTEGER      NOT NULL DEFAULT 0,
          refunded_cents           INTEGER      NOT NULL DEFAULT 0,
          -- Links to the fiat ledger once reconciled. Cash never gets one, which is exactly why
          -- the ledger cannot be derived from Stripe alone.
          payment_id               UUID,
          failure_reason           TEXT,
          captured_at              TIMESTAMPTZ,
          metadata                 JSONB        NOT NULL DEFAULT '{}',
          created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT pos_sale_payments_method_check
            CHECK (method IN ('card', 'cash', 'gift_card', 'rcn', 'other')),
          CONSTRAINT pos_sale_payments_status_check
            CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'))
        );

        CREATE INDEX IF NOT EXISTS idx_pos_sale_payments_sale ON pos_sale_payments (sale_id);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sale_payments_intent
          ON pos_sale_payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

        INSERT INTO schema_migrations (version, name) VALUES (256, 'create_pos_sales');
        RAISE NOTICE 'Migration 256 (create_pos_sales) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 256 (create_pos_sales) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS pos_sale_payments;
-- DROP TABLE IF EXISTS pos_sale_items;
-- DROP TABLE IF EXISTS pos_sales;
-- DELETE FROM schema_migrations WHERE version = 256;
-- COMMIT;
