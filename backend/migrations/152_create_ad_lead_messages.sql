-- Ads System (Stage 3.5) — full AI auto-answer: a per-lead conversation store.
--
-- Ad leads are wallet-less, so they CANNOT live in the wallet-keyed `conversations`
-- table. This is their own thread store, keyed by lead_id. When a lead replies and
-- the campaign has ai_agent_enabled, the AI auto-answers; otherwise the admin sees
-- the thread and replies/relays manually (Option C still works). Outbound message
-- TRANSPORT (SMS/WhatsApp/Messenger) is a separate, credential-gated concern — this
-- table records the conversation regardless of whether real delivery is wired.

CREATE TABLE IF NOT EXISTS ad_lead_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES ad_leads(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  author          TEXT NOT NULL CHECK (author IN ('lead','ai','admin')),
  channel         TEXT NOT NULL DEFAULT 'manual'
                    CHECK (channel IN ('sms','whatsapp','messenger','email','manual')),
  body            TEXT NOT NULL,
  -- AI inference cost for an 'ai' message (fractional cents — same scale as ad_ai_costs).
  ai_cost_cents   NUMERIC(12,4) NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'recorded'
                    CHECK (delivery_status IN ('recorded','queued','sent','delivered','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_lead_messages_lead ON ad_lead_messages (lead_id, created_at);
