-- AI Usage Overage (T3.2) Slice 1: per-shop opt-in to keep full-power AI running past the monthly
-- allowance (billed "Usage x3" — metering/charging land in Slices 2-3). When a shop enables this AND
-- the ENABLE_AI_OVERAGE flag is on, SpendCapEnforcer stops degrading to Haiku at 100% and keeps the
-- full model. Default false (unchanged behavior). Additive + idempotent.
-- Plan: docs/tasks/strategy/pricing-alignment/ai-usage-overage-implementation-plan.md
ALTER TABLE ai_shop_settings ADD COLUMN IF NOT EXISTS ai_overage_enabled BOOLEAN NOT NULL DEFAULT false;
