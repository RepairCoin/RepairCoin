-- Migration: 257_create_shop_tax_rates.sql
-- Author: Nico Regalado
-- Date: 2026-08-03
-- Description: Sales tax for the POS (S3). A shop-level rate that locations inherit, with an
--   optional per-location override, plus a taxability flag on each catalogue entry. Repair is
--   exactly the trade where a flat rate is wrong: in many US states parts are taxable and
--   labour is not.
--
--   Existing rows default to taxable, which changes nothing on its own -- a shop has no rate
--   until it creates one, so tax stays zero until the shop deliberately sets it up.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 257) THEN

        CREATE TABLE IF NOT EXISTS shop_tax_rates (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id     VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          -- NULL means the shop-wide default. A row with a location_id overrides it for that
          -- branch only; store hours inherit the same way, unlike holiday overrides.
          location_id UUID REFERENCES shop_locations(id) ON DELETE CASCADE,
          name        TEXT         NOT NULL DEFAULT 'Sales tax',
          rate_bps    INTEGER      NOT NULL,
          active      BOOLEAN      NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT shop_tax_rates_bps_check CHECK (rate_bps >= 0 AND rate_bps <= 10000)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_tax_rate_default
          ON shop_tax_rates (shop_id) WHERE location_id IS NULL AND active;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_tax_rate_location
          ON shop_tax_rates (shop_id, location_id) WHERE location_id IS NOT NULL AND active;

        ALTER TABLE shop_services
          ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true;

        ALTER TABLE inventory_items
          ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true;

        INSERT INTO schema_migrations (version, name) VALUES (257, 'create_shop_tax_rates');
        RAISE NOTICE 'Migration 257 (create_shop_tax_rates) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 257 (create_shop_tax_rates) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS shop_tax_rates;
-- ALTER TABLE shop_services   DROP COLUMN IF EXISTS taxable;
-- ALTER TABLE inventory_items DROP COLUMN IF EXISTS taxable;
-- DELETE FROM schema_migrations WHERE version = 257;
-- COMMIT;
