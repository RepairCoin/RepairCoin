-- 128_create_ai_marketing_messages.sql
--
-- Audit log for the AI Marketing Assistant — the shop-owner-facing AI that
-- drafts and proposes marketing campaigns ("send a Black Friday campaign",
-- "bring back lapsed customers"). See
--   docs/tasks/strategy/ai-marketing-campaigns/scope.md
--   docs/tasks/strategy/ai-marketing-campaigns/implementation.md
--
-- Shape mirrors ai_insights_messages (migration 122) — same shop-scoped,
-- session-grouped audit pattern with a tool_calls JSONB array. Separate
-- table because the audience and feature are distinct, and per-surface
-- audit isolation makes cost attribution and review queries simpler.
--
-- session_id is client-generated (frontend mints one per panel open and
-- reuses across multi-turn). Not a FK — marketing sessions are not
-- tracked anywhere else.

CREATE TABLE IF NOT EXISTS ai_marketing_messages (
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

CREATE INDEX IF NOT EXISTS idx_ai_marketing_messages_shop_created
  ON ai_marketing_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_marketing_messages_session_created
  ON ai_marketing_messages(session_id, created_at);

COMMENT ON TABLE ai_marketing_messages IS
  'Audit log of every AI Marketing Assistant Claude call. Separate from ai_help_messages (How-To) / ai_insights_messages (Business-Data Insights) / ai_agent_messages (customer chat) so per-surface cost attribution stays clean.';

COMMENT ON COLUMN ai_marketing_messages.session_id IS
  'Client-generated id grouping multi-turn rows from one marketing-panel session. Not a FK.';

COMMENT ON COLUMN ai_marketing_messages.tool_calls IS
  'Array of tools Claude invoked during this request. Each entry: {tool, args, displayKind?, latencyMs, error?}. Empty array when Claude declined / answered without tool use.';

COMMENT ON COLUMN ai_marketing_messages.request_payload IS
  'The validated request body: { sessionId, messages: [{ role, content }, ...] }.';

COMMENT ON COLUMN ai_marketing_messages.response_payload IS
  'Claude response (Anthropic SDK shape). NULL when the call errored — error_message captures the failure reason.';

COMMENT ON COLUMN ai_marketing_messages.cached_input_tokens IS
  'Anthropic prompt-cache hits on the stable system prompt block (tool descriptions + guardrails + template scaffolds). Subset of input_tokens billed at the cached rate.';
