-- 121_create_ai_help_messages.sql
--
-- Audit log for the How-To Assistant (shop-owner-facing in-dashboard
-- product help AI). See
--   docs/tasks/strategy/how-to-assistant/how-to-assistant-scope.md
--   docs/tasks/strategy/how-to-assistant/how-to-assistant-implementation.md
--
-- Distinct from `ai_agent_messages` (customer-AI chat) because the help
-- assistant has no `conversation_id` and no `customer_address` — those
-- columns are NOT NULL on the existing table. Carrying a separate
-- table avoids invasive schema changes on a load-bearing audit table.
--
-- session_id is client-generated: the frontend mints an id when the
-- help panel opens and sends it with every request in that panel
-- session. Lets us group multi-turn rows for analytics ("how many
-- turns did a typical session take") without a FK to a sessions
-- table (we don't track help sessions anywhere else).

CREATE TABLE IF NOT EXISTS ai_help_messages (
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
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_help_messages_shop_created
  ON ai_help_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_help_messages_session_created
  ON ai_help_messages(session_id, created_at);

COMMENT ON TABLE ai_help_messages IS
  'Audit log of every How-To Assistant Claude call: shop-owner-facing product help (not customer chat). Separate from ai_agent_messages because the help assistant has no conversation_id or customer_address.';

COMMENT ON COLUMN ai_help_messages.session_id IS
  'Client-generated id grouping multi-turn rows from one help-panel session. Not a FK — help sessions are not tracked in any other table.';

COMMENT ON COLUMN ai_help_messages.request_payload IS
  'The validated request body: { messages: [{ role, content }, ...] }.';

COMMENT ON COLUMN ai_help_messages.response_payload IS
  'Claude response (Anthropic SDK shape). NULL when the call errored — error_message captures the failure reason in that case.';

COMMENT ON COLUMN ai_help_messages.cached_input_tokens IS
  'Anthropic prompt-cache hits on the system prompt block (corpus + guardrails). Subset of input_tokens billed at the cached rate.';
