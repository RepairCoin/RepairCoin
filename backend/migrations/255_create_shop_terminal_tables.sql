-- Migration: 255_create_shop_terminal_tables.sql
-- Author: Nico Regalado
-- Date: 2026-08-03
-- Description: Stripe Terminal locations and readers (POS Phase 1). Both objects live on the
--   shop's connected account, so stripe_account_id is part of their identity — a shop that
--   repoints to a new account must not keep addressing ids minted on the old one.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 255) THEN

        CREATE TABLE IF NOT EXISTS shop_terminal_locations (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id            VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          location_id        UUID         NOT NULL REFERENCES shop_locations(id) ON DELETE CASCADE,
          stripe_account_id  VARCHAR(255) NOT NULL,
          stripe_location_id VARCHAR(255) NOT NULL,
          display_name       TEXT,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_location_per_account
          ON shop_terminal_locations (stripe_account_id, location_id);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_location_stripe_id
          ON shop_terminal_locations (stripe_account_id, stripe_location_id);

        CREATE INDEX IF NOT EXISTS idx_terminal_locations_shop
          ON shop_terminal_locations (shop_id);

        CREATE TABLE IF NOT EXISTS shop_terminal_readers (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id              VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
          terminal_location_id UUID         NOT NULL REFERENCES shop_terminal_locations(id) ON DELETE CASCADE,
          stripe_account_id    VARCHAR(255) NOT NULL,
          stripe_reader_id     VARCHAR(255) NOT NULL,
          label                TEXT,
          device_type          VARCHAR(64),
          serial_number        VARCHAR(128),
          -- Cache of the last status Stripe reported; presence is not pushed, so never gate a
          -- payment on it.
          status               VARCHAR(16),
          last_seen_at         TIMESTAMPTZ,
          is_default           BOOLEAN      NOT NULL DEFAULT false,
          created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_reader_stripe_id
          ON shop_terminal_readers (stripe_account_id, stripe_reader_id);

        CREATE INDEX IF NOT EXISTS idx_terminal_readers_shop
          ON shop_terminal_readers (shop_id);

        CREATE INDEX IF NOT EXISTS idx_terminal_readers_location
          ON shop_terminal_readers (terminal_location_id);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_reader_default_per_location
          ON shop_terminal_readers (terminal_location_id) WHERE is_default;

        INSERT INTO schema_migrations (version, name) VALUES (255, 'create_shop_terminal_tables');
        RAISE NOTICE 'Migration 255 (create_shop_terminal_tables) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 255 (create_shop_terminal_tables) already applied';
    END IF;
END $$;

-- Rollback (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS shop_terminal_readers;
-- DROP TABLE IF EXISTS shop_terminal_locations;
-- DELETE FROM schema_migrations WHERE version = 255;
-- COMMIT;
