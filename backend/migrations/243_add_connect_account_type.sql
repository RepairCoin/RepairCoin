-- Migration: 243_add_connect_account_type.sql
-- Author: Nico Regalado
-- Date: 2026-07-27
-- Description: Track the Stripe Connect account TYPE per shop, so the embedded "Get Paid"
--   onboarding (Express, no redirect) can be told apart from legacy Standard/OAuth accounts.
--   NULL = not connected yet; 'standard' = legacy OAuth account; 'express' = new embedded.

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 243) THEN

        ALTER TABLE shops ADD COLUMN IF NOT EXISTS connect_account_type VARCHAR(20);

        -- Backfill: any shop that already has a connected account came in via the OAuth
        -- Standard flow, so mark it 'standard'. New Express accounts set 'express' on create.
        UPDATE shops
           SET connect_account_type = 'standard'
         WHERE stripe_connect_account_id IS NOT NULL
           AND connect_account_type IS NULL;

        -- ================================================
        -- RECORD MIGRATION
        -- ================================================
        INSERT INTO schema_migrations (version, name) VALUES (243, 'add_connect_account_type');

        RAISE NOTICE 'Migration 243 (add_connect_account_type) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 243 (add_connect_account_type) already applied';
    END IF;
END $$;

-- ================================================
-- ROLLBACK SCRIPT (Optional - for manual use only)
-- ================================================
-- To rollback this migration, run:
-- BEGIN;
-- -- Your rollback SQL here
-- -- DROP TABLE IF EXISTS example_table;
-- DELETE FROM schema_migrations WHERE version = 243;
-- COMMIT;
