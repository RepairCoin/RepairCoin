-- Migration: Add database constraints for max_bonus on percentage promo codes
-- Bug Fix: max_bonus Not Stored Atomically With Percentage Validation
--
-- Problem: Percentage promo codes could be created without max_bonus, allowing unlimited bonuses
-- Solution: Add CHECK constraints to enforce:
--   1. Percentage codes must have a positive max_bonus
--   2. max_bonus cannot exceed 10,000 RCN (reasonable upper bound)

BEGIN;

-- First, check if any existing percentage codes violate the constraint
-- and fix them by setting a default max_bonus
UPDATE promo_codes
SET max_bonus = LEAST(bonus_value * 100, 10000),
    updated_at = CURRENT_TIMESTAMP
WHERE bonus_type = 'percentage'
  AND (max_bonus IS NULL OR max_bonus <= 0);

-- Add constraint: Percentage promo codes require a positive max_bonus
-- The constraint allows:
--   - bonus_type != 'percentage' (any max_bonus value including NULL)
--   - bonus_type = 'percentage' AND max_bonus IS NOT NULL AND max_bonus > 0
ALTER TABLE promo_codes
DROP CONSTRAINT IF EXISTS percentage_requires_max_bonus;

ALTER TABLE promo_codes
ADD CONSTRAINT percentage_requires_max_bonus
CHECK (
  bonus_type != 'percentage' OR
  (bonus_type = 'percentage' AND max_bonus IS NOT NULL AND max_bonus > 0)
);

-- Add constraint: max_bonus cannot exceed 10,000 RCN (reasonable upper bound)
-- This prevents accidental or malicious creation of promo codes with extreme bonuses
ALTER TABLE promo_codes
DROP CONSTRAINT IF EXISTS max_bonus_reasonable;

ALTER TABLE promo_codes
ADD CONSTRAINT max_bonus_reasonable
CHECK (max_bonus IS NULL OR max_bonus <= 10000);

-- Add constraint: bonus_value for percentage must be between 1 and 100
ALTER TABLE promo_codes
DROP CONSTRAINT IF EXISTS percentage_bonus_value_valid;

ALTER TABLE promo_codes
ADD CONSTRAINT percentage_bonus_value_valid
CHECK (
  bonus_type != 'percentage' OR
  (bonus_type = 'percentage' AND bonus_value > 0 AND bonus_value <= 100)
);

-- Add constraint: fixed bonus must be positive
ALTER TABLE promo_codes
DROP CONSTRAINT IF EXISTS fixed_bonus_value_positive;

ALTER TABLE promo_codes
ADD CONSTRAINT fixed_bonus_value_positive
CHECK (
  bonus_type != 'fixed' OR
  (bonus_type = 'fixed' AND bonus_value > 0)
);

COMMIT;

-- Verify constraints were created
SELECT 'SUCCESS: max_bonus constraints added to promo_codes table' as status
WHERE EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'percentage_requires_max_bonus'
) AND EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'max_bonus_reasonable'
) AND EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'percentage_bonus_value_valid'
) AND EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'fixed_bonus_value_positive'
);

-- Show current constraints on promo_codes
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'promo_codes'::regclass
  AND contype = 'c'
ORDER BY conname;
