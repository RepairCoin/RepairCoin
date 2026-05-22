-- 126_create_ai_insights_pinned_queries.sql
--
-- Phase 7.3 — saved queries.
--
-- Stores shop-owner-pinned questions. Pinning = saving the user's
-- question text; the "Pinned" tab in the InsightsPanel lists them;
-- tapping one re-submits via the normal chat pipeline.
--
-- Implicit signal: anything pinned IS a question that matters to
-- the shop owner. Gives us a free data set for "which questions are
-- worth optimizing" without instrumentation.
--
-- last_run_at + last_response_excerpt are populated by a PUT call
-- after each pinned-tap submit succeeds, so the Pinned tab can show
-- "Last run 3 days ago — Your shop made $2,117..." preview lines.
--
-- display_order lets the user reorder pins later (Phase 8 feature);
-- v1 sort order is `display_order ASC, pinned_at DESC` which yields
-- "most-recently-pinned first" when all rows have display_order = 0.

CREATE TABLE IF NOT EXISTS ai_insights_pinned_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- The user's question text verbatim. Capped at 2000 to match the
  -- 4000-char message limit but skewed shorter — pin labels need
  -- to render in a tight list view.
  question_text VARCHAR(2000) NOT NULL,

  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Set by PUT /:id/run after each pinned-tap submit succeeds.
  -- Null = never run from the pinned tab (could still have been
  -- asked manually).
  last_run_at TIMESTAMP,
  last_response_excerpt TEXT,

  -- Phase 8 reorder support. v1 always 0; sorted by pinned_at DESC
  -- within the same order.
  display_order INTEGER NOT NULL DEFAULT 0
);

-- List query path: WHERE shop_id = $1 ORDER BY display_order, pinned_at DESC.
CREATE INDEX IF NOT EXISTS idx_ai_insights_pinned_shop_order
  ON ai_insights_pinned_queries(shop_id, display_order, pinned_at DESC);

COMMENT ON TABLE ai_insights_pinned_queries IS
  'Shop-owner-pinned questions for the Insights panel "Pinned" tab. Tap a row to re-submit the question via the normal chat pipeline.';

COMMENT ON COLUMN ai_insights_pinned_queries.question_text IS
  'User question verbatim. Submitted unchanged when the pinned row is tapped.';

COMMENT ON COLUMN ai_insights_pinned_queries.last_response_excerpt IS
  'First ~200 chars of the most recent assistant reply triggered by this pinned query. Refreshed each tap. NULL until first run.';
