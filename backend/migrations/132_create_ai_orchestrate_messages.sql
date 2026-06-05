-- 132_create_ai_orchestrate_messages.sql
--
-- Audit log for the Unified "Talk To My Business" assistant (v2) — the
-- owner-facing orchestrator that answers AND acts across domains in one
-- conversation. See
--   docs/tasks/strategy/unified-assistant/implementation.md
--   docs/tasks/strategy/voice-ai-dispatcher/unified-assistant-vision.md
--
-- Shape mirrors ai_insights_messages (migration 122) — same shop-scoped,
-- session-grouped, tool_calls-bearing audit pattern. Separate table because
-- the orchestrator spans BOTH the insights and marketing tool registries in a
-- single turn, so its tool_calls and cost profile are distinct from any single
-- per-panel surface.
--
-- session_id is client-generated (frontend mints once per conversation and
-- reuses across multi-turn). Not a FK — orchestrator sessions are not tracked
-- elsewhere (stateless in Phase 1; server-side persistence is Phase 2).

CREATE TABLE IF NOT EXISTS ai_orchestrate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  model VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_orchestrate_messages_shop_created
  ON ai_orchestrate_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_orchestrate_messages_session_created
  ON ai_orchestrate_messages(session_id, created_at);

COMMENT ON TABLE ai_orchestrate_messages IS
  'Audit log of every Unified Assistant (orchestrator) Claude call. Cross-domain (insights + marketing tools in one turn); separate from ai_insights_messages / ai_marketing_messages / ai_agent_messages because the surface and cost profile are distinct.';

COMMENT ON COLUMN ai_orchestrate_messages.session_id IS
  'Client-generated id grouping multi-turn rows from one orchestrator conversation. Not a FK.';

COMMENT ON COLUMN ai_orchestrate_messages.tool_calls IS
  'Array of tools Claude invoked this turn across domains. Each entry: {tool, args, display?}. Empty when answered without tool use.';

COMMENT ON COLUMN ai_orchestrate_messages.response_payload IS
  'Last Claude response (Anthropic SDK shape). NULL when the call errored — error_message captures the reason.';

COMMENT ON COLUMN ai_orchestrate_messages.cached_input_tokens IS
  'Anthropic prompt-cache hits on the stable system prompt block. Subset of input_tokens billed at the cached rate.';
