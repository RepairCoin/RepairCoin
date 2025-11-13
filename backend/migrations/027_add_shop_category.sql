-- Add category column to shops table
-- Migration: 027_add_shop_category.sql

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add check constraint to ensure only valid categories
ALTER TABLE shops
ADD CONSTRAINT shops_category_check
CHECK (category IS NULL OR category IN (
  'Repairs and Tech',
  'Health and Wellness',
  'Beauty and Personal Care',
  'Fitness and Lifestyle',
  'Home and Auto Service'
));

-- Add index for filtering by category
CREATE INDEX IF NOT EXISTS idx_shops_category ON shops(category);

-- Comment
COMMENT ON COLUMN shops.category IS 'Shop business category for classification';
