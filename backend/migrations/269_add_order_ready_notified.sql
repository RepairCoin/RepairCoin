-- Custom Workflows §9.3.2 — the `order_ready` trigger.
--
-- "Ready for pickup", generalised. The scope line said "repair ready", but repairs are ~21% of services
-- on the platform (beauty 37, repairs 34, fitness 20, automotive 10, pet care, tech…), and for a barber
-- or a gym class there is nothing to collect — "ready" and "completed" are the same instant. The gap
-- between those two moments only exists for DROP-OFF businesses, which is why this is opt-in per order
-- rather than a lifecycle stage every shop has to pass through.
--
-- Deliberately NOT a new service_orders.status value. A status would force every query that filters on
-- status to be audited — including the revenue/booked split from 6c388d31e, where a new value silently
-- landing in the wrong bucket is exactly the bug that took a week to notice. It would also put a stage
-- in the booking flow that makes no sense for most shops on the platform.
--
-- So: one additive timestamp. The order still goes paid → completed exactly as before; this records
-- that the shop told the customer it was ready, which is a fact about a NOTIFICATION, not about the
-- order's state.

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS ready_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN service_orders.ready_notified_at IS
  'When the shop told the customer the order was ready for pickup. Drives the order_ready workflow trigger and makes the button idempotent. Not a lifecycle status — the order''s status is unaffected.';

-- Answers "has this already been sent" for the button, which is the only read.
CREATE INDEX IF NOT EXISTS idx_service_orders_ready_notified
  ON service_orders (shop_id, ready_notified_at)
  WHERE ready_notified_at IS NOT NULL;
