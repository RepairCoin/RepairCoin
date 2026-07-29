-- 252: allow a SHOP-SCOPED automation run to be recorded (Custom Workflows — low_stock).
--
-- Every trigger until now was customer-scoped: a booking completed, a review landed, a customer went
-- quiet. `low_stock` is the first that happens to the SHOP, with no customer involved at all — which is
-- why it needed the notify_staff action first, and why auto_message_sends.customer_address (NOT NULL)
-- now blocks recording that a rule ran.
--
-- NULL customer_address = "this rule fired for the shop, not for anybody in particular".
--
-- Note what stays correct for free: the enrolled counts in the Automation list are
-- COUNT(DISTINCT customer_address), and SQL ignores NULLs — so a shop-scoped workflow shows 0 enrolled,
-- which is exactly right. Nobody is enrolled in it; it simply runs. "Last run" keeps working because
-- that reads sent_at.
--
-- Existing rows are untouched: every one is customer-scoped and keeps its address.

ALTER TABLE auto_message_sends
  ALTER COLUMN customer_address DROP NOT NULL;

COMMENT ON COLUMN auto_message_sends.customer_address IS
  'The customer this run targeted. NULL for shop-scoped triggers (e.g. low_stock), which fire for the shop itself.';
