-- 116_add_ai_followup_settings.sql
--
-- Per-shop config for the AI sales follow-up nudge (see
-- docs/tasks/strategy/ai-sales-agent/ai-sales-followup-nudge.md).
--
-- When a customer goes quiet mid-conversation, the AI sends ONE friendly
-- follow-up after `ai_followup_delay_minutes` to re-engage and keep the
-- sale alive.
--
-- ai_followup_enabled defaults to FALSE — STAGED ROLLOUT. The detector
-- runs platform-wide, but no shop sends follow-ups until its flag is
-- explicitly flipped on:
--   UPDATE ai_shop_settings SET ai_followup_enabled = TRUE WHERE shop_id = '<shop>';
-- This is an AI-initiated, customer-facing behavior — higher risk than the
-- AI merely replying — so it ships dark and is enabled shop-by-shop.

ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS ai_followup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_followup_delay_minutes INTEGER NOT NULL DEFAULT 20;

COMMENT ON COLUMN ai_shop_settings.ai_followup_enabled IS
  'When TRUE, the AI sends one follow-up nudge to a customer who goes quiet mid-conversation. Defaults FALSE — staged rollout, enable per shop.';
COMMENT ON COLUMN ai_shop_settings.ai_followup_delay_minutes IS
  'Minutes of customer silence before the AI sales follow-up nudge fires (default 20).';

-- conversations(last_message_at) is already indexed by migration 079
-- (idx_conversations_last_message) — the detector scan reuses it.
