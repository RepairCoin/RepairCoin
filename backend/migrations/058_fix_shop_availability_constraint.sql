-- Migration: Fix shop_availability unique constraint
-- Date: 2026-01-12
-- Description: Add missing unique constraint on shop_availability for ON CONFLICT clause

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'shop_availability_shop_id_day_of_week_key'
        AND conrelid = 'shop_availability'::regclass
    ) THEN
        -- Add the unique constraint
        ALTER TABLE shop_availability
        ADD CONSTRAINT shop_availability_shop_id_day_of_week_key
        UNIQUE (shop_id, day_of_week);

        RAISE NOTICE 'Added unique constraint shop_availability_shop_id_day_of_week_key';
    ELSE
        RAISE NOTICE 'Unique constraint shop_availability_shop_id_day_of_week_key already exists';
    END IF;
END $$;

-- Verify the constraint exists
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'shop_availability'::regclass;
