-- 234_create_ai_recommendations.sql
--
-- P0 — "AI Recommendations for You" (shop dashboard overview).
-- Scope: docs/tasks/strategy/ai-recommendations/scope.md
--
-- Stores per-shop recommendation cards produced by the nightly detector run.
-- A recommendation differs from an anomaly (ai_insights_anomalies, migration
-- 125): an anomaly is an OBSERVATION ("revenue down 40% WoW"), a
-- recommendation is a PRESCRIPTION WITH AN ACTION ("send a win-back campaign
-- to these 87 customers"). Hence the typed `action` + the evidence payload.
--
-- Deliberately mirrors the anomaly table's lifecycle so both surfaces behave
-- the same way: soft-dismiss, auto-expiry, shop-scoped active-set query.
--
-- Active set (used by GET /api/ai/recommendations):
--   WHERE shop_id = $1
--     AND dismissed_at IS NULL
--     AND (snoozed_until IS NULL OR snoozed_until < NOW())
--     AND expires_at > NOW()
--   ORDER BY score DESC, detected_at DESC
--
-- `evidence` is the contract that keeps the copy honest: every number rendered
-- on a card MUST come from here, so a card can never claim a figure no
-- detector computed. (The mock this replaces told every shop "87 inactive
-- customers" regardless of their data.)

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Detector identity — 'lapsed_customers', 'low_stock', 'slow_period', …
  -- See services/recommendations/detectors/. New detectors need no migration.
  detector_key VARCHAR(64) NOT NULL,

  -- Drives the dashboard filter chips.
  category VARCHAR(32) NOT NULL,

  severity VARCHAR(16) NOT NULL,          -- 'low' | 'medium' | 'high'

  -- Ranking value computed at generation time (severity x recency x
  -- actionability). Stored so the read path is a plain ORDER BY.
  score NUMERIC NOT NULL DEFAULT 0,

  -- The numbers behind the copy: { "inactiveCustomers": 87, "days": 90 }.
  -- Rendered into the title/description templates AND the assistantPrompt.
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Typed destination for the card tap. One of:
  --   { "kind": "navigate",  "tab": "inventory" }
  --   { "kind": "assistant", "prompt": "..." }
  --   { "kind": "campaign",  "audience": "lapsed_90d" }
  action JSONB NOT NULL,

  -- Always populated, whatever the primary action is — powers the secondary
  -- "ask AI about this" tap. Templated from `evidence`, never AI-generated.
  assistant_prompt TEXT,

  -- Feature key the shop must have to ACT on this (e.g. 'inventoryManagement').
  -- NULL = no extra gate beyond the feed's own. Filtering happens server-side
  -- at read time as well, so a tier downgrade can't leak a stale row.
  required_feature VARCHAR(64),

  -- Deterministic template copy. Claude phrasing (P4) overwrites these; on
  -- failure the template stands, so the feed never renders blank.
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP,                 -- permanent "not relevant to me"
  snoozed_until TIMESTAMP,                -- temporary hide; may resurface
  acted_at TIMESTAMP,                     -- tapped through — conversion signal
  expires_at TIMESTAMP NOT NULL,          -- detected_at + 14 days

  CONSTRAINT ck_rec_severity CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT ck_rec_category CHECK (
    category IN ('revenue', 'customers', 'marketing', 'inventory', 'operations')
  )
);

-- Active-set query path (feed read + dismiss/snooze).
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_shop_active
  ON ai_recommendations(shop_id, dismissed_at, expires_at);

-- Dedupe helper — the generator skips re-creating a detector's card while an
-- active one already exists for that shop.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_recommendations_shop_detector_active
  ON ai_recommendations(shop_id, detector_key)
  WHERE dismissed_at IS NULL AND acted_at IS NULL;

COMMENT ON TABLE ai_recommendations IS
  'Per-shop actionable recommendation cards for the dashboard feed. Detected by pure-SQL detectors (no AI), ranked + tier-gated server-side, phrased from templates. Sibling to ai_insights_anomalies: anomalies observe, recommendations prescribe.';

COMMENT ON COLUMN ai_recommendations.evidence IS
  'The detector-computed numbers behind the copy. CONTRACT: every figure shown on a card must come from here — no card may state a number nothing computed.';

COMMENT ON COLUMN ai_recommendations.action IS
  'Typed card destination: {kind:navigate,tab} | {kind:assistant,prompt} | {kind:campaign,audience}.';

COMMENT ON COLUMN ai_recommendations.required_feature IS
  'featureTiers key gating the ACTION (e.g. inventoryManagement). Enforced server-side at read time, so recommendations a shop cannot act on are never returned.';
