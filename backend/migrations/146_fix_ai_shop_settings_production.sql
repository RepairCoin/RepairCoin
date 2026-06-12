-- Migration 146: Fix ai_shop_settings missing on production
--
-- Migration 110 failed on production because ai_agent_messages had a FK
-- referencing conversations(conversation_id), but production's conversations
-- table was created without a PRIMARY KEY / UNIQUE constraint on that column
-- (schema drift). This migration recreates both tables safely and adds the
-- columns from migration 116 that also failed as a result.

-- ============================================================================
-- 1. Ensure conversations(conversation_id) has a unique constraint
--    so future FK references work correctly.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversations'::regclass
      AND contype IN ('p', 'u')
      AND conname IN (
        SELECT constraint_name FROM information_schema.key_column_usage
        WHERE table_name = 'conversations' AND column_name = 'conversation_id'
      )
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_conversation_id_unique UNIQUE (conversation_id);
  END IF;
END $$;

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

-- ============================================================================
-- 3. AI_AGENT_MESSAGES TABLE — audit log (soft reference to conversations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft reference (no FK) — avoids constraint issues from schema drift
  conversation_id VARCHAR(255) NOT NULL,
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

-- ============================================================================
-- 4. Backfill — give every existing shop a default ai_shop_settings row
-- ============================================================================
INSERT INTO ai_shop_settings (shop_id)
SELECT shop_id FROM shops
ON CONFLICT (shop_id) DO NOTHING;

-- ============================================================================
-- 5. Add followup columns from migration 116 (failed because 110 failed)
-- ============================================================================
ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS ai_followup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_followup_delay_minutes INTEGER NOT NULL DEFAULT 20;
