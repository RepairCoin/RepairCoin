-- 236_add_ai_recommendation_presentation.sql
--
-- P5 — one engine, two surfaces (scope decision D5).
--
-- The dashboard has two blocks that both say "here is what you should do":
--   * "AI Recommendations for You"  — a scrolling list of findings
--   * "Priority Actions"            — a 3-up grid of do-this-now tiles
--
-- Both were hardcoded mocks. Rather than build a second engine (which would
-- drift and eventually contradict the first), a detector now declares WHERE its
-- output belongs and what its button says:
--
--   presentation = 'card'   → the recommendations list  (default)
--   presentation = 'action' → the Priority Actions grid
--
-- cta_label is the tile's button text ("Contact Leads", "Send Requests"). NULL
-- for cards, which use the row affordances instead.

ALTER TABLE ai_recommendations
  ADD COLUMN IF NOT EXISTS presentation VARCHAR(16) NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS cta_label    TEXT;

ALTER TABLE ai_recommendations
  DROP CONSTRAINT IF EXISTS ck_rec_presentation;

ALTER TABLE ai_recommendations
  ADD CONSTRAINT ck_rec_presentation CHECK (presentation IN ('card', 'action'));

-- The feed reads one surface at a time, so presentation joins the active-set
-- lookup key.
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_shop_presentation
  ON ai_recommendations(shop_id, presentation, dismissed_at, expires_at);

COMMENT ON COLUMN ai_recommendations.presentation IS
  'Which dashboard surface renders this: card = AI Recommendations list, action = Priority Actions grid. One engine, two surfaces (D5) — a second engine would drift and contradict the first.';

COMMENT ON COLUMN ai_recommendations.cta_label IS
  'Button text for Priority Action tiles ("Contact Leads"). NULL for cards.';
