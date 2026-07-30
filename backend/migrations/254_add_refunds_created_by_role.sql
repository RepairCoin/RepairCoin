-- Migration: 254_add_refunds_created_by_role.sql
-- Author: Nico Regalado
-- Date: 2026-07-30
-- Description: Who issued a refund — the shop itself, or FixFlow (Payments Center, Slice A2).
--   `created_by` holds a wallet address, which cannot answer that question: an admin's wallet
--   is indistinguishable from an owner's once written to the column. These are Connect direct
--   charges, so a platform-issued refund debits the MERCHANT's own balance — the shop must be
--   able to see in its own drawer that FixFlow, not one of its staff, took that money. A silent
--   debit is how support tickets are made.
--
--   Existing rows are all shop-issued: A2 is the first code path that can write 'admin'.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 254) THEN

        ALTER TABLE refunds
          ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16) NOT NULL DEFAULT 'shop';

        -- Constrained rather than free text: the shop drawer branches on this value, and an
        -- unexpected one would render as neither "you" nor "FixFlow".
        ALTER TABLE refunds
          DROP CONSTRAINT IF EXISTS refunds_created_by_role_check;
        ALTER TABLE refunds
          ADD CONSTRAINT refunds_created_by_role_check
          CHECK (created_by_role IN ('shop', 'admin'));

        INSERT INTO schema_migrations (version, name) VALUES (254, 'add_refunds_created_by_role');
        RAISE NOTICE 'Migration 254 (add_refunds_created_by_role) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 254 (add_refunds_created_by_role) already applied';
    END IF;
END $$;
