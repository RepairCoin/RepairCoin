-- 122_create_ai_insights_messages.sql
--
-- Audit log for the Business-Data Insights assistant — the "Ask about
-- your business" half of Square AI. See
--   docs/tasks/strategy/business-data-insights/business-data-insights-scope.md
--   docs/tasks/strategy/business-data-insights/business-data-insights-implementation.md
--
-- Shape mirrors ai_help_messages (migration 121) — same shop-scoped,
-- session-grouped audit pattern — with one extra column:
--
--   tool_calls JSONB — the array of tools Claude invoked while
--     answering this request, including args + result summaries. Each
--     element is {tool, args, displayKind?, latencyMs, error?}. Lets us
--     audit which tools the model is reaching for + whether their
--     selection rate is improving over time.
--
-- session_id is client-generated (frontend mints once per panel open
-- and reuses across multi-turn). Not a FK — insights sessions are not
-- tracked anywhere else.

CREATE TABLE IF NOT EXISTS ai_insights_messages (
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

CREATE INDEX IF NOT EXISTS idx_ai_insights_messages_shop_created
  ON ai_insights_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_messages_session_created
  ON ai_insights_messages(session_id, created_at);

COMMENT ON TABLE ai_insights_messages IS
  'Audit log of every Business-Data Insights Claude call (Sonnet + tool-use). Separate from ai_help_messages (How-To Assistant) and ai_agent_messages (customer chat) because the audience and feature are distinct. Includes a tool_calls JSONB capturing which insights tools Claude invoked.';

COMMENT ON COLUMN ai_insights_messages.session_id IS
  'Client-generated id grouping multi-turn rows from one insights-panel session. Not a FK.';

COMMENT ON COLUMN ai_insights_messages.tool_calls IS
  'Array of tools Claude invoked during this request. Each entry: {tool, args, displayKind?, latencyMs, error?}. Empty array when Claude declined / answered without tool use.';

COMMENT ON COLUMN ai_insights_messages.request_payload IS
  'The validated request body: { sessionId, messages: [{ role, content }, ...] }.';

COMMENT ON COLUMN ai_insights_messages.response_payload IS
  'Claude response (Anthropic SDK shape). NULL when the call errored — error_message captures the failure reason in that case.';

COMMENT ON COLUMN ai_insights_messages.cached_input_tokens IS
  'Anthropic prompt-cache hits on the stable system prompt block (tool descriptions + guardrails). Subset of input_tokens billed at the cached rate.';
