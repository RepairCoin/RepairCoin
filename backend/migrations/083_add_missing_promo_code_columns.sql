-- Migration: Add missing columns to promo_codes table
-- Adds columns that the PromoCodeService expects

BEGIN;

-- Add missing columns if they don't exist
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS used_count INT4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;

-- Copy data from existing columns to new columns
UPDATE promo_codes SET
  discount_type = bonus_type,
  discount_value = bonus_value,
  status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END,
  used_count = times_used,
  valid_from = start_date,
  valid_until = end_date
WHERE discount_type IS NULL;

-- Add index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON promo_codes(status);

COMMIT;

-- Verify columns were added
SELECT 'SUCCESS: promo_codes table now has ' || COUNT(*) || ' columns' as status
FROM information_schema.columns
WHERE table_name = 'promo_codes';
