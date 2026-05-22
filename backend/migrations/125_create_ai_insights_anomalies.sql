-- 125_create_ai_insights_anomalies.sql
--
-- Phase 7.2 — anomaly detection.
--
-- Stores per-shop, per-metric anomaly detections from the nightly
-- `AnomalyDetector` run. Each row = one flagged delta (week-over-week
-- movement that exceeded its metric's severity threshold). The
-- `AnomalyPhraser` later populates `claude_phrasing` +
-- `follow_up_question` via a one-shot Sonnet call.
--
-- Shop owner sees anomalies as a top-of-panel banner (Phase 7.2.16)
-- with a "Tell me more" tap that submits `follow_up_question` as a
-- new chat message, and a "Dismiss" tap that sets `dismissed_at`.
--
-- Active set query (used by GET /api/ai/insights/anomalies):
--   WHERE shop_id = $1
--     AND dismissed_at IS NULL
--     AND expires_at > NOW()
--   ORDER BY detected_at DESC LIMIT 3
--
-- Auto-expiry at 14 days post-detection keeps the banner from
-- showing stale anomalies the shop owner has implicitly already
-- acknowledged by ignoring them.

CREATE TABLE IF NOT EXISTS ai_insights_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Metric identifier — 'weekly_revenue', 'weekly_no_shows', etc.
  -- See backend/src/domains/AIAgentDomain/services/insights/anomalies/types.ts
  -- for the canonical list. New metrics added later go here without
  -- a migration.
  metric_key VARCHAR(64) NOT NULL,

  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- The two values that produced the flag. Stored raw so we can
  -- reconstruct the comparison shape for the banner without re-
  -- running the SQL.
  current_value NUMERIC NOT NULL,
  prior_value NUMERIC NOT NULL,
  delta_value NUMERIC NOT NULL,        -- current_value - prior_value
  delta_pct NUMERIC,                   -- NULL when prior_value = 0
  z_score NUMERIC,                     -- reserved for tunability later

  severity VARCHAR(16) NOT NULL,       -- 'low' | 'medium' | 'high'

  -- Populated by AnomalyPhraser after detection. NULL when phrasing
  -- failed (spend-cap exhausted, Claude API error) — banner falls
  -- back to a template phrase in that case.
  claude_phrasing TEXT,

  -- The "Tell me more" chip target. Populated alongside claude_phrasing.
  follow_up_question TEXT,

  dismissed_at TIMESTAMP,              -- NULL = active
  expires_at TIMESTAMP NOT NULL,       -- detected_at + INTERVAL '14 days'

  CONSTRAINT ck_severity CHECK (severity IN ('low', 'medium', 'high'))
);

-- Active-set query path (banner fetch + dismiss endpoint).
CREATE INDEX IF NOT EXISTS idx_ai_insights_anomalies_shop_active
  ON ai_insights_anomalies(shop_id, dismissed_at, expires_at);

-- Dedupe helper — used by AnomalyDetector to skip re-flagging the
-- same metric within the same detection window.
CREATE INDEX IF NOT EXISTS idx_ai_insights_anomalies_shop_metric_detected
  ON ai_insights_anomalies(shop_id, metric_key, detected_at DESC);

COMMENT ON TABLE ai_insights_anomalies IS
  'Per-shop, per-metric anomaly flags from the nightly AnomalyDetector. Surfaced as top-of-panel banners with Claude-phrased descriptions + tap-to-investigate follow-up questions. Soft-dismiss + 14-day auto-expiry.';

COMMENT ON COLUMN ai_insights_anomalies.metric_key IS
  'Canonical metric identifier. Phase 7.2 v1 list: weekly_revenue, weekly_no_shows, weekly_cancellations, weekly_ai_conversations, weekly_bookings.';

COMMENT ON COLUMN ai_insights_anomalies.severity IS
  'low: 30-60% delta or 2.0-2.5 z. medium: 60-150% or 2.5-3.5. high: >150% or >3.5.';

COMMENT ON COLUMN ai_insights_anomalies.claude_phrasing IS
  'One-sentence natural-language summary from AnomalyPhraser. NULL on phrasing failure — UI falls back to a template phrase.';

COMMENT ON COLUMN ai_insights_anomalies.follow_up_question IS
  'Suggested investigative question the banner exposes as a "Tell me more" tap. Submits via the standard chat pipeline.';
