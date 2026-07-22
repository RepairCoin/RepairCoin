-- 237_add_ai_recommendation_phrasing.sql
--
-- P4 — optional AI-phrased copy for recommendation cards.
--
-- Stored in SEPARATE columns rather than overwriting title/description, for
-- three reasons:
--   1. The deterministic template must stay recoverable. It is the fallback
--      whenever the spend cap is exhausted, the API errors, or the rewrite is
--      rejected (below) — and a feed that renders blank is worse than a plain one.
--   2. The two must be comparable. Validating a rewrite against the template's
--      evidence is only possible if both survive.
--   3. Cost analysis can tell phrased from unphrased rows.
--
-- Mirrors ai_insights_anomalies.claude_phrasing (migration 125), which keeps
-- the raw metric values alongside Claude's sentence for the same reasons.
--
-- ⚠️ THE RULE THIS FEATURE EXISTS TO PROTECT: every figure on a card must come
-- from the detector's `evidence`. An AI rewrite is the one thing that can
-- silently break it — dropping a number, rounding it, or inventing one, which
-- is exactly the mock bug this whole feature replaced. RecommendationPhraser
-- therefore validates every number in the rewritten title against `evidence`
-- and discards the rewrite if any figure is unaccounted for. These columns stay
-- NULL in that case and the template is used.

ALTER TABLE ai_recommendations
  ADD COLUMN IF NOT EXISTS ai_title       TEXT,
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS phrased_at     TIMESTAMP;

-- The phraser's work queue: rows that have never been considered.
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_unphrased
  ON ai_recommendations(shop_id)
  WHERE phrased_at IS NULL AND dismissed_at IS NULL;

COMMENT ON COLUMN ai_recommendations.ai_title IS
  'Claude-rewritten title. NULL = use the deterministic `title` (spend cap exhausted, API error, or the rewrite failed evidence validation).';

COMMENT ON COLUMN ai_recommendations.ai_description IS
  'Claude-rewritten description. NULL alongside ai_title — the pair is written together or not at all.';

COMMENT ON COLUMN ai_recommendations.phrased_at IS
  'When the phraser last CONSIDERED this row — set even when the rewrite was rejected, so a row is never retried in a loop and burns budget.';
