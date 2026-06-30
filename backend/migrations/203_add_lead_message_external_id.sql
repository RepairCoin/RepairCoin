-- 203 — Inbound email dedupe. Store the inbound email's Message-ID on the recorded message so a
-- re-delivered webhook for the same email is skipped (idempotency). Indexed per-lead for the lookup.
-- See docs/tasks/strategy/ads-system/ads-inbound-email-scope.md. Idempotent.
ALTER TABLE ad_lead_messages ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_lead_messages_external ON ad_lead_messages (lead_id, external_id);
