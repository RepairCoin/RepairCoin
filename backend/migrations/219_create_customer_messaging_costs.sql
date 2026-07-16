-- Phase 3 (AI Auto-Replies channel expansion): per-reply cost ledger for off-app AI messaging
-- (SMS / WhatsApp). Records BOTH cost streams from D5 so management can see the true cost of each
-- reply and decide who bears it (bundle into Business / pass through / cap):
--   • ai_cost_cents      — the Claude inference cost (precise, fractional cents)
--   • carrier_cost_cents — the estimated Twilio (per-segment) / WhatsApp (per-message) transport cost
-- Distinct from the shop-level AI spend cap (which already counts inference) — this is the off-channel
-- P&L / billing ledger. Additive + idempotent.
-- Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
CREATE TABLE IF NOT EXISTS customer_messaging_costs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  conversation_id    TEXT,
  customer_address   TEXT,
  channel            TEXT NOT NULL,                        -- 'sms' | 'whatsapp'
  ai_cost_cents      NUMERIC(12,4) NOT NULL DEFAULT 0,     -- Claude inference (fractional cents)
  carrier_cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,     -- estimated transport (0 when the send didn't leave)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_messaging_costs_shop
  ON customer_messaging_costs (shop_id, created_at DESC);
