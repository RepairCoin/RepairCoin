-- 231 — A/B testing for Auto-Messages (AI Campaigns Advanced, Phase 4).
--
-- A single-message rule can carry a second variant (variant B). When present, each send is randomly
-- assigned variant 'A' (messageTemplate) or 'B' (variant_b) 50/50, and the choice is recorded per send so
-- outcomes can be compared. Additive + idempotent; a rule with no variant_b behaves exactly as before.
-- A/B is mutually exclusive with drip sequences (mig 230) — enforced in the controller.
--
--   shop_auto_messages.variant_b — the B message (NULL = single variant / no A/B).
--   auto_message_sends.variant   — which variant this send used ('A' | 'B'); NULL = not an A/B send.

ALTER TABLE shop_auto_messages
  ADD COLUMN IF NOT EXISTS variant_b TEXT;

ALTER TABLE auto_message_sends
  ADD COLUMN IF NOT EXISTS variant TEXT;
