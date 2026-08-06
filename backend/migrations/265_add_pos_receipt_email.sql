-- Migration: 265_add_pos_receipt_email.sql
-- Author: Nico Regalado
-- Date: 2026-08-06
-- Description: Give a counter sale somewhere to send the customer's receipt (POS S6c-1).
--
--   Most counter sales are walk-ins: on staging only 3 of 20 sales name a customer, and a wallet
--   address is the only contact detail a POS sale has ever carried. A receipt gated on being a
--   registered customer would reach roughly one sale in seven, so the register captures an address
--   at checkout instead. It is optional — a cash customer who wants no receipt is the normal case,
--   not a failure.
--
--   `receipt_sent_at` records that the email actually went out. The send happens off the
--   `pos.sale_completed` event, after the money is taken, so a failure there is invisible at the
--   register by design; this column is how "did they get it?" gets answered afterwards.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 265) THEN

        ALTER TABLE pos_sales
          ADD COLUMN IF NOT EXISTS receipt_email   TEXT,
          ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;

        INSERT INTO schema_migrations (version, name) VALUES (265, 'add_pos_receipt_email');
        RAISE NOTICE 'Migration 265 (add_pos_receipt_email) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 265 (add_pos_receipt_email) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- ALTER TABLE pos_sales DROP COLUMN IF EXISTS receipt_sent_at, DROP COLUMN IF EXISTS receipt_email;
-- DELETE FROM schema_migrations WHERE version = 265;
-- COMMIT;
