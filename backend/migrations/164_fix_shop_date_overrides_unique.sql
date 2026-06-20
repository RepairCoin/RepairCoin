-- Migration 164: Restore UNIQUE(shop_id, override_date) on shop_date_overrides
--
-- The createDateOverride repository INSERT uses
--   ON CONFLICT (shop_id, override_date) DO UPDATE ...
-- which REQUIRES a unique constraint on those columns. Migration 008 declared it,
-- but the staging/production tables were recreated by a production-sync migration
-- with a drifted schema (override_id became varchar, and the unique constraint was
-- lost). Result: every "Add Override" fails with
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- surfaced to the app as a generic "Failed to add override."
--
-- This restores the constraint. Safe to run repeatedly (guarded by catch on
-- duplicate_object). Dedupe first in case drift allowed duplicate rows.

-- Remove any duplicate (shop_id, override_date) rows, keeping the most recent.
DELETE FROM shop_date_overrides a
USING shop_date_overrides b
WHERE a.shop_id = b.shop_id
  AND a.override_date = b.override_date
  AND a.created_at < b.created_at;

DO $$
BEGIN
  ALTER TABLE shop_date_overrides
    ADD CONSTRAINT shop_date_overrides_shop_id_override_date_key
    UNIQUE (shop_id, override_date);
EXCEPTION
  WHEN duplicate_object THEN NULL; -- constraint already exists
  WHEN duplicate_table THEN NULL;  -- index name already exists
END $$;
