-- 230 — Drip / multi-step sequences for Auto-Messages (AI Campaigns Advanced, Phase 3).
--
-- A sequence rule fires an ORDERED set of steps over time (e.g. reminder → offer → last-chance) instead of
-- one message. Built on the existing pending-send queue (auto_message_sends): each step is a scheduled
-- pending send, and firing one enqueues the next. Additive + idempotent; a rule with no steps behaves
-- exactly as before (single messageTemplate).
--
--   shop_auto_messages.steps         — JSONB array [{ "messageTemplate": "...", "delayHours": N }, ...].
--                                      NULL / [] = legacy single-message rule (unchanged behavior).
--   shop_auto_messages.stop_on_booking — exit condition: skip remaining steps once the customer books.
--   auto_message_sends.step_index    — which sequence step this pending send is for (NULL = legacy single).

ALTER TABLE shop_auto_messages
  ADD COLUMN IF NOT EXISTS steps           JSONB,
  ADD COLUMN IF NOT EXISTS stop_on_booking BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE auto_message_sends
  ADD COLUMN IF NOT EXISTS step_index INTEGER;
