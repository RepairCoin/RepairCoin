-- Migration: Create AI Agent tables for Phase 3 Claude integration
-- Description: Creates ai_agent_messages (audit log of every Claude call) and
--              ai_shop_settings (per-shop AI config + monthly budget caps)
-- Date: 2026-05-05
-- Phase 3 Task 2 of `docs/tasks/strategy/ai-sales-agent/ai-sales-agent-claude-integration-plan.md`

-- ============================================================================
-- 1. AI_AGENT_MESSAGES TABLE — audit log of every Claude API call
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  -- service_id is a soft reference (no FK) because shop_services.service_id has
  -- no PRIMARY KEY/UNIQUE constraint on staging (pre-existing schema drift —
  -- migration 036 declares it as UUID PK, but the live table is VARCHAR with no PK).
  -- We index it for query performance below. If/when shop_services drift is fixed,
  -- a follow-up migration can add the FK.
  service_id VARCHAR(255),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  customer_address VARCHAR(255) NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  model VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  latency_ms INTEGER,
  escalated_to_human BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_shop_created ON ai_agent_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_conversation ON ai_agent_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_customer ON ai_agent_messages(customer_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_service ON ai_agent_messages(service_id) WHERE service_id IS NOT NULL;

COMMENT ON TABLE ai_agent_messages IS 'Audit log of every AI Claude API call: request, response, model used, token counts, cost, latency, errors';
COMMENT ON COLUMN ai_agent_messages.tool_calls IS 'Empty in Phase 3 MVP (button-based booking only); populated when Phase 4 ships direct tool-call booking';
COMMENT ON COLUMN ai_agent_messages.cached_input_tokens IS 'Anthropic prompt cache hits — subset of input_tokens billed at lower cached rate';
COMMENT ON COLUMN ai_agent_messages.escalated_to_human IS 'True if EscalationDetector triggered human handoff for this turn';
COMMENT ON COLUMN ai_agent_messages.error_message IS 'Populated when the Anthropic call failed (rate-limited, timeout, invalid request, etc.); response_payload is NULL in this case';

-- ============================================================================
-- 2. AI_SHOP_SETTINGS TABLE — per-shop AI config + budget caps
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_shop_settings (
  shop_id VARCHAR(255) PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  ai_global_enabled BOOLEAN NOT NULL DEFAULT false,
  monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  current_month_spend_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  current_month_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  escalation_threshold INTEGER NOT NULL DEFAULT 5,
  business_hours_only_ai BOOLEAN NOT NULL DEFAULT false,
  blacklist_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_shop_settings_global_enabled ON ai_shop_settings(ai_global_enabled) WHERE ai_global_enabled = true;

COMMENT ON TABLE ai_shop_settings IS 'Per-shop AI Sales Agent config: master kill-switch, monthly budget cap, escalation rules';
COMMENT ON COLUMN ai_shop_settings.ai_global_enabled IS 'Master kill-switch per shop. Defaults to FALSE — must be explicitly enabled. UPDATE ai_shop_settings SET ai_global_enabled=false stops all AI globally without code changes.';
COMMENT ON COLUMN ai_shop_settings.monthly_budget_usd IS 'Per-shop monthly USD cap. SpendCapEnforcer auto-throttles to Haiku at 70% and blocks new requests at 100%.';
COMMENT ON COLUMN ai_shop_settings.current_month_started_at IS 'Tracks when current_month_spend_usd was last reset. Auto-rolls when calendar month advances (handled in SpendCapEnforcer, not via cron).';
COMMENT ON COLUMN ai_shop_settings.escalation_threshold IS 'Always handoff to human after N consecutive AI replies in a single conversation';
COMMENT ON COLUMN ai_shop_settings.blacklist_keywords IS 'Array of keywords that trigger automatic escalation when present in customer message';

-- ============================================================================
-- 3. BACKFILL — give every existing shop a default settings row
-- ============================================================================
INSERT INTO ai_shop_settings (shop_id)
SELECT shop_id FROM shops
ON CONFLICT (shop_id) DO NOTHING;
