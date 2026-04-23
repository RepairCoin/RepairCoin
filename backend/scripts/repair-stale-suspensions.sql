-- Repair stale no-show suspensions
--
-- Finds customers stuck at no_show_tier='suspended' with no
-- booking_suspended_until timer (NULL). The SuspensionLiftService cron
-- ignores these rows because its WHERE clause requires the timer to be
-- non-null and elapsed. Without repair, affected customers remain
-- suspended forever.
--
-- This script is intentionally standalone — not a migration — because:
--  1. It is environment-dependent: most DBs won't have stale rows, so
--     running it on every migration pass would be wasted work.
--  2. It is an operational repair rather than a schema change.
--
-- Usage:
--   Step 1: Inspect candidates and decide if the repair is appropriate:
--     SELECT address, no_show_count, last_no_show_at
--     FROM customers
--     WHERE no_show_tier = 'suspended'
--       AND booking_suspended_until IS NULL;
--
--   Step 2: Run the repair UPDATE below. It applies the same cascade
--   thresholds SuspensionLiftService uses (3/2/1) and resets the
--   successful_appointments_since_tier3 counter.

UPDATE customers
SET
  no_show_tier = CASE
    WHEN no_show_count >= 3 THEN 'deposit_required'
    WHEN no_show_count >= 2 THEN 'caution'
    WHEN no_show_count = 1 THEN 'warning'
    ELSE 'normal'
  END,
  deposit_required = (no_show_count >= 3),
  successful_appointments_since_tier3 = 0,
  updated_at = NOW()
WHERE no_show_tier = 'suspended'
  AND booking_suspended_until IS NULL
RETURNING address, no_show_count, no_show_tier;
