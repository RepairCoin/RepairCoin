-- Migration: 251_add_payments_created_index.sql
-- Author: Nico Regalado
-- Date: 2026-07-29
-- Description: Index for platform-wide payment reads (Payments Center, Slice A1).
--   Every existing index on `payments` leads with shop_id (idx_payments_shop,
--   idx_payments_customer), which serves the shop-scoped screens but is useless to the admin
--   list: it drops the scope predicate and orders by created_at across all shops, so Postgres
--   falls back to a sequential scan plus a sort that grows with the whole ledger.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 251) THEN

        CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at DESC);

        INSERT INTO schema_migrations (version, name) VALUES (251, 'add_payments_created_index');
        RAISE NOTICE 'Migration 251 (add_payments_created_index) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 251 (add_payments_created_index) already applied';
    END IF;
END $$;
