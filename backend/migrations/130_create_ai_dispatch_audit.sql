-- 130_create_ai_dispatch_audit.sql
--
-- Audit log for the Voice AI Dispatcher Phase 3 — cross-domain routing.
-- See docs/tasks/strategy/voice-ai-dispatcher/implementation.md §4 Phase 3.
--
-- The dispatcher endpoint (POST /api/ai/dispatch) accepts a transcript +
-- session id, asks Haiku to classify it into ONE of:
--   INSIGHTS | MARKETING | HELP | OUT_OF_SCOPE
-- and returns the decision so the frontend can open the matching panel
-- (InsightsLauncher / MarketingAILauncher / HelpAssistantLauncher) with
-- the transcript pre-filled.
--
-- This table records every router decision for:
--   1. Cost attribution — Haiku-classification cost is distinct from the
--      downstream Sonnet panel cost, isolating them keeps audit reads
--      clean.
--   2. Accuracy review — replay all transcripts where router_decision =
--      OUT_OF_SCOPE to find missed routing opportunities; replay all
--      transcripts that got the "wrong" domain (caller flag set via
--      future feedback API) to tune the prompt.
--   3. Latency / token diagnostics same as the other ai_* messages tables.
--
-- transcript_source: where the request originated.
--   'voice'      = global mic (dashboard pill / header / mobile +)
--   'inline_mic' = per-panel mic (Phase 5.5 — D3 hybrid handoff)
--
-- shop_id is JWT-scoped via the controller; session_id is client-generated
-- and groups multi-turn dispatch from the same panel-open session.

CREATE TABLE IF NOT EXISTS ai_dispatch_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  transcript TEXT NOT NULL,
  transcript_source VARCHAR(20) NOT NULL,
  router_decision VARCHAR(20) NOT NULL,
  router_input_tokens INTEGER NOT NULL DEFAULT 0,
  router_output_tokens INTEGER NOT NULL DEFAULT 0,
  router_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_transcript_source_valid
    CHECK (transcript_source IN ('voice', 'inline_mic')),
  CONSTRAINT check_router_decision_valid
    CHECK (router_decision IN ('insights', 'marketing', 'help', 'out_of_scope', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_ai_dispatch_audit_shop_created
  ON ai_dispatch_audit(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_audit_session_created
  ON ai_dispatch_audit(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_audit_decision
  ON ai_dispatch_audit(router_decision, created_at DESC);

COMMENT ON TABLE ai_dispatch_audit IS
  'Audit log of every cross-domain router classification (Haiku, 4-way INSIGHTS/MARKETING/HELP/OUT_OF_SCOPE). One row per /api/ai/dispatch call.';

COMMENT ON COLUMN ai_dispatch_audit.transcript_source IS
  'Where the transcript originated. ''voice'' = global mic surfaces (pill / header / mobile +). ''inline_mic'' = per-panel mic with D3 hybrid (Phase 5.5).';

COMMENT ON COLUMN ai_dispatch_audit.router_decision IS
  'One of insights / marketing / help / out_of_scope. ''error'' is reserved for the case where Haiku returned a label we couldn''t parse — we normalize to out_of_scope in the response but record the original failure here for tuning.';

COMMENT ON COLUMN ai_dispatch_audit.router_cost_usd IS
  'Haiku call cost only. The downstream Sonnet call (in the opened panel) is audited separately in ai_insights_messages / ai_marketing_messages / ai_help_messages.';
