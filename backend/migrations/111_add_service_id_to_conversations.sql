-- Migration: Add service_id to conversations for AI Sales Agent context
-- Description: Phase 3 Task 8 — links a conversation to the service the
--              customer is asking about, so the AI hook can fire with the
--              right per-service context (kill-switch, tone, prompt data).
-- Date: 2026-05-06
-- Phase 3 Task 8 of `docs/tasks/strategy/ai-sales-agent/ai-sales-agent-claude-integration-plan.md`

-- service_id is a soft reference (no FK) because shop_services.service_id has
-- no PRIMARY KEY/UNIQUE constraint on staging. Same rationale as migration 110
-- (ai_agent_messages.service_id). If schema drift gets fixed later, FK can be
-- added then.
--
-- NULL is the explicit default for legacy conversations created before this
-- migration. AgentOrchestrator skips AI when service_id is NULL — graceful
-- degradation for old threads.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS service_id VARCHAR(255);

-- Lookup index — used by the AI hook + admin diagnostics that filter
-- conversations by service.
CREATE INDEX IF NOT EXISTS idx_conversations_service_id
  ON conversations(service_id)
  WHERE service_id IS NOT NULL;
