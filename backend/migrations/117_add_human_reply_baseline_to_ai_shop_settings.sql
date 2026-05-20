-- 117_add_human_reply_baseline_to_ai_shop_settings.sql
--
-- Per-shop human-reply baseline for the AI Sales Agent Impact Metrics
-- feature (see docs/tasks/strategy/ai-sales-agent/ai-sales-agent-impact-metrics.md).
--
-- The "Time your AI saved you" metric on the Impact section is a
-- counterfactual: how long a human would have taken to reply, minus how
-- long the AI actually took, multiplied by AI message count. The "how
-- long a human would have taken" piece is unknowable, so each shop sets
-- their own baseline. The displayed metric is always labeled "estimated"
-- with the configured baseline visible (scope-doc Section 5 decision E).
--
-- Default 240 minutes (4h). The check constraint clamps to 15..1440 to
-- block silly values (negative, zero, or > 24h).

ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS human_reply_baseline_minutes INTEGER NOT NULL DEFAULT 240;

-- Idempotent constraint refresh: Postgres has no ADD CONSTRAINT IF NOT
-- EXISTS, so drop-then-add keeps the migration re-runnable safely.
ALTER TABLE ai_shop_settings
  DROP CONSTRAINT IF EXISTS ai_shop_settings_human_reply_baseline_range;

ALTER TABLE ai_shop_settings
  ADD CONSTRAINT ai_shop_settings_human_reply_baseline_range
  CHECK (human_reply_baseline_minutes BETWEEN 15 AND 1440);

COMMENT ON COLUMN ai_shop_settings.human_reply_baseline_minutes IS
  'Per-shop assumed human-reply baseline in minutes, used by the Impact Metrics "Time your AI saved you" estimate. Default 240 (4h). Range 15-1440 enforced by check constraint.';
