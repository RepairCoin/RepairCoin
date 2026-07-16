-- Phase 1 (AI Auto-Replies SMS): per-shop SMS number registry.
-- Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md (D2)
--
-- Each shop texts customers from / receives on its OWN dedicated number, so an inbound message's
-- `To` number unambiguously identifies the shop (a shared number can't, once a customer deals with
-- 2+ shops). This table is IDENTICAL for D2 Option A (platform-provisioned Twilio number) and
-- Option B (BYO / hosted SMS on the shop's existing number) — only HOW a row gets populated
-- (buy-a-number vs signed LOA) differs, so building it now does NOT pre-commit that decision.
--
-- Until a shop has an active row: outbound falls back to the shared TWILIO_SMS_FROM, and inbound
-- can't attribute by `To` (the resolver handles both gracefully). Additive + idempotent.
CREATE TABLE IF NOT EXISTS shop_sms_numbers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  sms_number        TEXT NOT NULL,                     -- E.164, the number customers text
  provisioning_mode TEXT NOT NULL DEFAULT 'platform',  -- 'platform' (Option A) | 'byo' (Option B)
  status            TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'pending' | 'released'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A number maps to at most one shop → deterministic To→shop inbound routing.
  CONSTRAINT uq_shop_sms_number UNIQUE (sms_number)
);

-- At most one ACTIVE number per shop (a shop sends/receives on a single number). Partial so
-- released/pending rows never block a re-assignment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_sms_active
  ON shop_sms_numbers (shop_id) WHERE status = 'active';
