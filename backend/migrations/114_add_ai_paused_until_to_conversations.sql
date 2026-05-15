-- 114_add_ai_paused_until_to_conversations.sql
--
-- AI auto-reply pause state on the conversations table. Drives the
-- Phase 2 human-handoff strategy (see
-- docs/tasks/strategy/ai-human-handoff-clash.md):
--
--   NULL                       → AI auto-reply is active
--   ai_paused_until > NOW()    → AI is paused; orchestrator skips with
--                                SkipReason 'ai_paused'
--   ai_paused_until <= NOW()   → expired auto-pause; AI is active
--
-- Two write paths drive this column:
--   1. Auto race-window pause: every time a non-AI shop message lands,
--      MessageRepository sets ai_paused_until = NOW() + 30 seconds.
--      Prevents the "AI talks over staff who's actively typing" failure
--      mode without making the customer wait long if staff walks away.
--   2. Explicit "Take Over" button: shop dashboard sets
--      ai_paused_until = NOW() + 100 years (effectively indefinite
--      until "Resume AI" clears it back to NULL).
--
-- Replaces the time-window heuristic shipped in Phase 1
-- (findMostRecentHumanShopMessage + HUMAN_TAKEOVER_QUIET_MINUTES) —
-- the heuristic is removed in the same change set so a single
-- source of truth exists for "is AI allowed to reply right now?"

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ;

COMMENT ON COLUMN conversations.ai_paused_until IS
  'When set in the future, the AI sales agent will NOT auto-reply on this conversation. Bumped to NOW() + 30 seconds on every non-AI shop message (race-window pause); set to NOW() + 100 years by the shop dashboard "Take Over" button (indefinite hold until "Resume AI" sets it back to NULL). NULL = AI is active.';

-- Partial index: only index rows that are currently paused. Tiny index
-- (most rows have NULL most of the time) but speeds up the orchestrator
-- prefilter which reads this column on every customer turn.
CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused_until
  ON conversations(ai_paused_until)
  WHERE ai_paused_until IS NOT NULL;
