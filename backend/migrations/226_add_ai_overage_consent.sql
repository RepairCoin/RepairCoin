-- AI Usage Overage (T3.2) Slice 2.5: record WHEN a shop consented to "Usage x3, pay as you grow".
-- Enabling overage now requires an explicit consent acknowledgement; this stamps the audit trail
-- (proof of agreement) that legal will want before real charging (Slice 3). Additive + idempotent.
-- Plan: docs/tasks/strategy/pricing-alignment/ai-usage-overage-implementation-plan.md
ALTER TABLE ai_shop_settings ADD COLUMN IF NOT EXISTS ai_overage_consent_at TIMESTAMPTZ;
