-- Phase 0 (AI Auto-Replies multi-channel foundation): make in-app conversations/messages
-- channel-aware so SMS + WhatsApp can later flow through the SAME AgentOrchestrator engine.
-- Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
--
-- Purely additive + idempotent. Existing rows default to 'app', so this is behavior-neutral
-- until the SMS/WhatsApp channels are wired (Phase 1/2, behind ENABLE_CUSTOMER_SMS/WHATSAPP flags).

-- Which channel a message/conversation lives on. 'app' = the existing in-app chat.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'app';
ALTER TABLE messages      ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'app';

-- D1(b): maps an external channel identity (phone in E.164 / WhatsApp id) to a conversation,
-- so an inbound SMS/WhatsApp can resolve to (and create) the right conversation without a wallet.
-- Mirrors the ad-leads model (findByPhone) but for regular-customer conversations.
CREATE TABLE IF NOT EXISTS conversation_channel_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  channel          TEXT NOT NULL,              -- 'sms' | 'whatsapp'
  external_id      TEXT NOT NULL,              -- E.164 phone (sms) or WhatsApp id
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One identity maps to at most one conversation per channel. An inbound (channel, external_id)
  -- resolves deterministically to its conversation.
  CONSTRAINT uq_channel_identity UNIQUE (channel, external_id)
);

-- Reverse lookup: given a conversation, find its external channel identities.
CREATE INDEX IF NOT EXISTS idx_channel_identity_conversation
  ON conversation_channel_identities (conversation_id);
