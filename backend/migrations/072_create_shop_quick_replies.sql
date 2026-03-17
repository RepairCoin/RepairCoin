-- Migration: Create shop_quick_replies table
-- Shops can manage a library of canned response templates for quick messaging

-- Ensure shops.shop_id has a unique or primary key constraint (required for FK references)
-- Check for BOTH unique (contype='u') AND primary key (contype='p') constraints
DO $$
BEGIN
  -- Only add if no unique or primary key constraint exists on shop_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shops'::regclass
    AND contype IN ('u', 'p')
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'shops'::regclass AND attname = 'shop_id')]
  ) THEN
    ALTER TABLE shops ADD CONSTRAINT shops_shop_id_unique UNIQUE (shop_id);
    RAISE NOTICE 'Added UNIQUE constraint on shops.shop_id';
  ELSE
    RAISE NOTICE 'shops.shop_id already has a unique/primary key constraint';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'shops.shop_id constraint check/add skipped: %', SQLERRM;
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
