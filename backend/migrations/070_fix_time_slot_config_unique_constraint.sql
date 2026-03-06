-- Migration: Fix missing UNIQUE constraint on shop_time_slot_config.shop_id
-- Date: 2026-03-03
-- Description: The original migration 008 defined shop_id as UNIQUE, but the constraint
--   was missing from the actual database. This causes the UPSERT query in
--   AppointmentRepository.updateTimeSlotConfig() to fail with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--   This migration adds the missing UNIQUE constraint.

-- First remove any duplicates (keep the most recently updated row per shop)
DELETE FROM shop_time_slot_config a
USING shop_time_slot_config b
WHERE a.shop_id = b.shop_id
  AND a.config_id < b.config_id;

-- Add the UNIQUE constraint (idempotent check via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_time_slot_config_shop_id_unique'
  ) THEN
    ALTER TABLE shop_time_slot_config
    ADD CONSTRAINT shop_time_slot_config_shop_id_unique UNIQUE (shop_id);
  END IF;
END $$;
