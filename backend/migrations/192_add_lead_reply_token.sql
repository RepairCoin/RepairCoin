-- 192 — Inbound email (lead replies → app). Per-lead opaque reply token: AI-agent campaign emails
-- send with reply-to = `${reply_token}@reply.fixflow.ai`, so a customer's reply hits our inbound
-- webhook and we resolve it back to this lead (no leadId leakage). Null until the first model-B send.
-- See docs/tasks/strategy/ads-system/ads-inbound-email-scope.md. Idempotent.
ALTER TABLE ad_leads ADD COLUMN IF NOT EXISTS reply_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_leads_reply_token ON ad_leads (reply_token) WHERE reply_token IS NOT NULL;
