-- 259_order_confirmation_flow.sql
--
-- Phase 2 of replacing "auto-expire + auto-refund after 24h" with a confirmation flow.
-- See docs/BOOKING_CONFIRMATION_FLOW_PLAN.md
--
-- Phase 1 already stopped the sweep from refunding. This adds the state an
-- unconfirmed booking parks in, so the customer gets an explicit say instead of
-- the booking silently sitting in 'paid' looking like it's still scheduled.
--
-- Refunds now only ever fire from a customer reporting the service didn't happen.

-- 1. Allow the new status ----------------------------------------------------
--
-- IMPORTANT: service_orders.status is guarded by a CHECK constraint pinned to the
-- existing nine values. It MUST be dropped and recreated — without this every
-- write of 'awaiting_confirmation' fails.
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN (
    'pending',
    'paid',
    'approved',
    'scheduled',
    'completed',
    'cancelled',
    'refunded',
    'no_show',
    'expired',              -- legacy: no new order enters this state, kept for history
    'awaiting_confirmation'
  ));

-- 2. Confirmation tracking ---------------------------------------------------
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS awaiting_confirmation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_reported_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_report_reason TEXT;

-- Listed by age in the customer's bookings and (Phase 3) an admin queue.
CREATE INDEX IF NOT EXISTS idx_service_orders_awaiting_confirmation
  ON service_orders (awaiting_confirmation_at)
  WHERE status = 'awaiting_confirmation';

-- The sweep scans paid orders past their grace window every 30 minutes.
CREATE INDEX IF NOT EXISTS idx_service_orders_completion_sweep
  ON service_orders (booking_date)
  WHERE status = 'paid' AND completed_at IS NULL;

-- 3. Per-shop policy ---------------------------------------------------------
-- shop_no_show_policy already owns appointment-outcome policy (it holds
-- dispute_window_days), so the completion windows belong here too.
ALTER TABLE shop_no_show_policy
  ADD COLUMN IF NOT EXISTS completion_grace_days         INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS completion_report_window_days INTEGER DEFAULT 14;

-- NOTE: historical 'expired' rows are deliberately NOT migrated. They were already
-- refunded, so moving them to 'awaiting_confirmation' would invite a second refund.
-- They keep the 'expired' status and its explanatory UI.
