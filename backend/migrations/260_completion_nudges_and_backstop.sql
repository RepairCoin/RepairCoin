-- 260_completion_nudges_and_backstop.sql
--
-- Phase 3 of the booking confirmation flow.
-- See docs/BOOKING_CONFIRMATION_FLOW_PLAN.md
--
-- Two jobs:
--   1. Nudge the shop BEFORE its grace window closes, so most bookings never need
--      the customer to get involved at all.
--   2. Guarantee that a booking nobody resolves eventually reaches a human, instead
--      of sitting in 'awaiting_confirmation' forever with the customer's money
--      unsettled. No automatic refund and no automatic settle — just escalation.
--
-- Depends on migration 259 (the awaiting_confirmation status).

-- 1. Shop nudges during the grace window (+24h, +72h, +6d past the appointment) ---
-- Flag-column-per-stage, matching the reminder_24h_sent_at / reminder_2h_sent_at
-- pattern already used for pre-appointment reminders.
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS completion_nudge_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_nudge_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_nudge_3_sent_at TIMESTAMPTZ;

-- 2. Customer reminders while awaiting confirmation (day 7, 21, 45) --------------
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS confirmation_reminder_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_reminder_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_reminder_3_sent_at TIMESTAMPTZ;

-- 3. The backstop ---------------------------------------------------------------
-- Set at day 90 in awaiting_confirmation. A FLAG, not a status change: the booking
-- stays exactly where it is and an admin decides. Day 90 is chosen so there is still
-- headroom to refund — card networks generally stop accepting refunds somewhere
-- around 120-180 days, after which an ignored booking becomes unrefundable and the
-- customer is the one who loses.
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS needs_admin_review_at TIMESTAMPTZ;

-- The admin queue lists these oldest-first.
CREATE INDEX IF NOT EXISTS idx_service_orders_needs_admin_review
  ON service_orders (needs_admin_review_at)
  WHERE needs_admin_review_at IS NOT NULL;
