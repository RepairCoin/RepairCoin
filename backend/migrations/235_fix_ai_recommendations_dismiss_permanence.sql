-- 235_fix_ai_recommendations_dismiss_permanence.sql
--
-- Bug fix on 234: a PERMANENTLY dismissed recommendation came back on the next
-- nightly run.
--
-- The dedupe index was:
--   UNIQUE (shop_id, detector_key) WHERE dismissed_at IS NULL AND acted_at IS NULL
--
-- Excluding dismissed rows meant they stopped blocking the insert, so
-- RecommendationService.generateForShop happily created a fresh card for a
-- detector the shop had explicitly said "not relevant to my business" about.
-- Dismiss was effectively a snooze until 03:00.
--
-- Correct rule — only ACTED rows should stop blocking:
--   * active   → blocks (no duplicate card)
--   * snoozed  → blocks (dismissed_at IS NULL; it returns when the snooze
--                expires, as the SAME row, so a duplicate would be wrong)
--   * dismissed→ blocks FOREVER (this is the fix)
--   * acted    → does NOT block, so a condition that is still true resurfaces
--                on the next run — which is the intended "clear it as you work
--                it, but don't pretend it's solved" behaviour.

DROP INDEX IF EXISTS idx_ai_recommendations_shop_detector_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_recommendations_shop_detector_active
  ON ai_recommendations(shop_id, detector_key)
  WHERE acted_at IS NULL;

COMMENT ON INDEX idx_ai_recommendations_shop_detector_active IS
  'Dedupe guard: one live card per (shop, detector). Only acted_at releases the slot — a dismissed card must never regenerate, and a snoozed one returns as the same row.';
