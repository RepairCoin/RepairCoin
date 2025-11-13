-- Set default category for existing shops
-- Migration: 028_set_default_shop_categories.sql

-- Update all shops with NULL category to 'Repairs and Tech'
UPDATE shops
SET category = 'Repairs and Tech'
WHERE category IS NULL;

-- Show how many shops were updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % shops to default category "Repairs and Tech"', updated_count;
END $$;
