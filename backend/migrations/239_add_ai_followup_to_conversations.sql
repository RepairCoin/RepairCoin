-- 239 — AI inactivity follow-up / closing state, stored on the conversation.
--
-- When the customer-messaging AI (AgentOrchestrator) follows the shop's saved
-- memory instructions to follow up after customer inactivity, it drafts the
-- message(s) during its normal reply (via the schedule_followup tool_use block)
-- and parks them here. A worker (AiFollowupScheduler) scans due rows and sends
-- them; an inbound customer message clears these columns (cancel-on-reply).
--
-- Follows the appointment-reminder precedent: time-based state as columns on the
-- entity row + a scheduler scanning by timestamp, rather than a queue table.
-- State machine per conversation: NULL -> 'followup' -> 'closing' -> NULL.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_followup_due_at TIMESTAMPTZ,   -- when the next queued action fires (NULL = none)
  ADD COLUMN IF NOT EXISTS ai_followup_stage  TEXT,          -- 'followup' | 'closing' | NULL
  ADD COLUMN IF NOT EXISTS ai_followup_text   TEXT,          -- AI-drafted follow-up message
  ADD COLUMN IF NOT EXISTS ai_closing_text    TEXT,          -- AI-drafted closing message (NULL = no closing step)
  ADD COLUMN IF NOT EXISTS ai_followup_gap_min INTEGER;      -- minutes of silence before each stage

-- Worker scan: only conversations with a pending action.
CREATE INDEX IF NOT EXISTS idx_conversations_ai_followup_due
  ON conversations (ai_followup_due_at)
  WHERE ai_followup_due_at IS NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (239, 'add_ai_followup_to_conversations')
ON CONFLICT (version) DO NOTHING;
