-- Migration: 230_add_stripe_connect_accounts.sql
-- Author: Nico Regalado
-- Date: 2026-07-17
-- Description: add stripe connect accounts
--
-- Onboarding columns for Stripe Connect (Express). Shops onboard as connected
-- accounts so customer payments can settle to them.
--
-- Scope note: docs/tasks/strategy/pricing-alignment/payments-processing-connect-scope.md
-- section 3 also specifies `payments_processing_enabled` and `platform_fee_bps` for the
-- per-transaction platform fee. Those are deliberately NOT added here — taking a cut is
-- what triggers that doc's section 7 legal gate. This migration covers onboarding only;
-- no money is moved and no fee is charged.

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 230) THEN

        ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS connect_onboarded_at TIMESTAMP WITH TIME ZONE;

        COMMENT ON COLUMN shops.stripe_connect_account_id IS 'Stripe Connect account id (acct_...) — the shop as a SELLER. Distinct from stripe_customers.stripe_customer_id, which is the shop as a subscription PAYER.';
        COMMENT ON COLUMN shops.connect_charges_enabled IS 'Mirror of Stripe account.charges_enabled, set from the account.updated webhook';
        COMMENT ON COLUMN shops.connect_payouts_enabled IS 'Mirror of Stripe account.payouts_enabled, set from the account.updated webhook';
        COMMENT ON COLUMN shops.connect_onboarded_at IS 'When charges_enabled first flipped true';

        -- The account.updated webhook arrives keyed by acct_..., so we look shops up by it.
        CREATE INDEX IF NOT EXISTS idx_shops_stripe_connect_account_id
            ON shops (stripe_connect_account_id)
            WHERE stripe_connect_account_id IS NOT NULL;

        -- ================================================
        -- RECORD MIGRATION
        -- ================================================
        INSERT INTO schema_migrations (version, name) VALUES (230, 'add_stripe_connect_accounts');

        RAISE NOTICE 'Migration 230 (add_stripe_connect_accounts) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 230 (add_stripe_connect_accounts) already applied';
    END IF;
END $$;

-- ================================================
-- ROLLBACK SCRIPT (Optional - for manual use only)
-- ================================================
-- To rollback this migration, run:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_shops_stripe_connect_account_id;
-- ALTER TABLE shops
--   DROP COLUMN IF EXISTS stripe_connect_account_id,
--   DROP COLUMN IF EXISTS connect_charges_enabled,
--   DROP COLUMN IF EXISTS connect_payouts_enabled,
--   DROP COLUMN IF EXISTS connect_onboarded_at;
-- DELETE FROM schema_migrations WHERE version = 230;
-- COMMIT;
