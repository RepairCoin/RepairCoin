-- Migration: 231_add_shop_linkedin.sql
-- Author: Nico Regalado
-- Date: 2026-07-17
-- Description: add shop linkedin
-- Adds the LinkedIn social column collected during shop registration.
-- Mirrors 016_add_social_media_fields.sql, which added facebook/twitter/instagram.

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 231) THEN

        ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255);

        COMMENT ON COLUMN shops.linkedin IS 'Shop LinkedIn page URL';

        -- ================================================
        -- RECORD MIGRATION
        -- ================================================
        INSERT INTO schema_migrations (version, name) VALUES (231, 'add_shop_linkedin');

        RAISE NOTICE 'Migration 231 (add_shop_linkedin) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 231 (add_shop_linkedin) already applied';
    END IF;
END $$;

-- ================================================
-- ROLLBACK SCRIPT (Optional - for manual use only)
-- ================================================
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE shops DROP COLUMN IF EXISTS linkedin;
-- DELETE FROM schema_migrations WHERE version = 231;
-- COMMIT;
