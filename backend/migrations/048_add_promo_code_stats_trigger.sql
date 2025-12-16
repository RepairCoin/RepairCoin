-- Migration: Add database triggers to keep promo code stats in sync
-- This ensures times_used and total_bonus_issued always match actual usage records,
-- preventing counter drift if application-level updates fail.
--
-- Bug Fix: times_used and total_bonus_issued Can Drift From Actual Records
-- Problem: Denormalized counters updated separately from usage insert could drift
-- Solution: Database triggers automatically update counters on INSERT/DELETE

BEGIN;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS promo_code_uses_insert_trigger ON promo_code_uses;
DROP TRIGGER IF EXISTS promo_code_uses_delete_trigger ON promo_code_uses;
DROP FUNCTION IF EXISTS update_promo_code_stats_on_insert();
DROP FUNCTION IF EXISTS update_promo_code_stats_on_delete();

-- Create function to update stats on INSERT
-- This is called AFTER each insert into promo_code_uses
CREATE OR REPLACE FUNCTION update_promo_code_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment times_used and add to total_bonus_issued
  UPDATE promo_codes
  SET times_used = times_used + 1,
      total_bonus_issued = total_bonus_issued + COALESCE(NEW.bonus_amount, 0),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.promo_code_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update stats on DELETE
-- This is called AFTER each delete from promo_code_uses (for rollbacks)
CREATE OR REPLACE FUNCTION update_promo_code_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement times_used and subtract from total_bonus_issued
  -- Use GREATEST to prevent negative values
  UPDATE promo_codes
  SET times_used = GREATEST(0, times_used - 1),
      total_bonus_issued = GREATEST(0, total_bonus_issued - COALESCE(OLD.bonus_amount, 0)),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.promo_code_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
CREATE TRIGGER promo_code_uses_insert_trigger
AFTER INSERT ON promo_code_uses
FOR EACH ROW
EXECUTE FUNCTION update_promo_code_stats_on_insert();

-- Create trigger for DELETE
CREATE TRIGGER promo_code_uses_delete_trigger
AFTER DELETE ON promo_code_uses
FOR EACH ROW
EXECUTE FUNCTION update_promo_code_stats_on_delete();

-- Sync existing data: Recalculate stats from actual usage records
-- This fixes any existing drift
UPDATE promo_codes pc
SET
  times_used = COALESCE(stats.actual_uses, 0),
  total_bonus_issued = COALESCE(stats.actual_bonus, 0),
  updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT
    promo_code_id,
    COUNT(*) as actual_uses,
    SUM(COALESCE(bonus_amount, 0)) as actual_bonus
  FROM promo_code_uses
  GROUP BY promo_code_id
) stats
WHERE pc.id = stats.promo_code_id
  AND (pc.times_used != stats.actual_uses OR pc.total_bonus_issued != stats.actual_bonus);

-- Also reset promo codes with no usage records but non-zero counters
UPDATE promo_codes
SET
  times_used = 0,
  total_bonus_issued = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE id NOT IN (SELECT DISTINCT promo_code_id FROM promo_code_uses)
  AND (times_used != 0 OR total_bonus_issued != 0);

COMMIT;

-- Verify triggers were created
SELECT 'SUCCESS: Promo code stats triggers created' as status
WHERE EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname = 'promo_code_uses_insert_trigger'
) AND EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname = 'promo_code_uses_delete_trigger'
);
