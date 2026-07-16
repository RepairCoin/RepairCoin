-- Phase 3 (D6) — opt-IN consent ledger for automated customer messaging (SMS / WhatsApp).
-- sms_opt_outs records opt-OUT (STOP); this records the affirmative opt-IN that TCPA / WhatsApp
-- require before a business sends automated messages. For the REACTIVE flow (the customer texts the
-- shop first) consent is implied and auto-recorded with source='inbound_message'; other sources
-- (a booking form, import, admin) can be added later. Keyed by (phone, channel), mirroring the
-- global opt-out list. Additive + idempotent.
-- Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
CREATE TABLE IF NOT EXISTS customer_messaging_consent (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,                       -- E.164
  channel     TEXT NOT NULL,                       -- 'sms' | 'whatsapp'
  status      TEXT NOT NULL DEFAULT 'granted',     -- 'granted' | 'revoked'
  source      TEXT,                                -- 'inbound_message' | 'form' | 'import' | 'admin'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_messaging_consent UNIQUE (phone, channel)
);
