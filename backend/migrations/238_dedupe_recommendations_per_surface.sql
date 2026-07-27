-- 238_dedupe_recommendations_per_surface.sql
--
-- Bug fix: the dedupe guard was one live row per (shop, detector), which is
-- wrong now that a detector can legitimately emit to BOTH surfaces.
--
--   was:  UNIQUE (shop_id, detector_key)              WHERE acted_at IS NULL
--   now:  UNIQUE (shop_id, detector_key, presentation) WHERE acted_at IS NULL
--
-- unanswered_leads emits a Priority Action tile AND a recommendations card —
-- the tile is the do-this-now prompt, the card is what makes `operations`
-- reachable in the list at all (it is the only operations detector). Under the
-- old index the second row was silently swallowed by ON CONFLICT DO NOTHING,
-- so only whichever was emitted first would ever exist. No error, no log — the
-- other surface would just never show it.
--
-- The intent was always "one live card per detector PER SURFACE"; the index
-- simply didn't say so. Everything else about the guard is unchanged: active
-- and snoozed rows still block, dismissed still blocks forever (235), and only
-- acted_at releases the slot.

DROP INDEX IF EXISTS idx_ai_recommendations_shop_detector_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_recommendations_shop_detector_active
  ON ai_recommendations(shop_id, detector_key, presentation)
  WHERE acted_at IS NULL;

COMMENT ON INDEX idx_ai_recommendations_shop_detector_active IS
  'Dedupe guard: one live row per (shop, detector, surface). A detector may emit to both the card list and the Priority Actions grid; only acted_at releases the slot, so a dismissed card never regenerates and a snoozed one returns as the same row.';
