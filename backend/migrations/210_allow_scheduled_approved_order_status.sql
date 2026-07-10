-- Widen service_orders.status to include 'scheduled' and 'approved'.
-- The booking lifecycle UI shows Requested → Paid → Approved → Scheduled → Completed, but the CHECK
-- constraint only allowed pending/paid/completed/cancelled/refunded/no_show/expired — so the Approved
-- and Scheduled steps could never be set (the shop "Mark Scheduled" button and the AI autopilot
-- paid→scheduled advance both silently failed on the constraint). Additive + idempotent.

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('pending','paid','approved','scheduled','completed','cancelled','refunded','no_show','expired'));
