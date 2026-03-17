-- Migration: Create shop_quick_replies table
-- Shops can manage a library of canned response templates for quick messaging

-- Ensure shops.shop_id has a unique constraint (required for FK references)
-- Some production databases may be missing this if shops table was created before migrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shops'::regclass AND contype = 'u'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'shops'::regclass AND attname = 'shop_id')]
  ) THEN
    BEGIN
      ALTER TABLE shops ADD CONSTRAINT shops_shop_id_unique UNIQUE (shop_id);
    EXCEPTION WHEN duplicate_table THEN
      -- constraint already exists under a different name
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shop_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_shop ON shop_quick_replies(shop_id, is_active);
