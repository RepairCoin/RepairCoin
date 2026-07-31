-- 247: actions as data (Custom Workflows W1 — docs/tasks/strategy/custom-workflows/scope.md §7).
--
-- shop_auto_messages has no column saying WHAT to do — it simply *has* message columns, so every rule
-- is a message rule because that is the only thing the table can describe. The engine matches:
-- AutoMessageSchedulerService ends both execution paths in a hardcoded messageRepo.createMessage().
-- Adding a non-messaging action (issue a reward, notify staff, flag a reorder) would therefore mean
-- new mostly-NULL columns plus another branch in an 848-line scheduler, every time.
--
-- action_type makes the action explicit so the engine can dispatch to a registered handler instead.
-- DEFAULT 'send_message' + NOT NULL means every existing rule keeps meaning exactly what it means
-- today — this migration changes no behaviour.
--
-- NOTE: message_template stays NOT NULL here. Relaxing it only matters once a rule exists that sends
-- no message, so it belongs to W2 (first non-messaging action) together with widening the TS type.
-- Doing it now would let NULLs in while the type still claims `string`.

ALTER TABLE shop_auto_messages
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(48) NOT NULL DEFAULT 'send_message',
  ADD COLUMN IF NOT EXISTS action_payload JSONB;

COMMENT ON COLUMN shop_auto_messages.action_type IS
  'What this rule DOES when it fires. Dispatched to a handler in autoMessageActions/registry.ts. Default send_message = the historical behaviour.';
COMMENT ON COLUMN shop_auto_messages.action_payload IS
  'Action-specific configuration. Unused by send_message, which reads the legacy message_template/steps/variant_b columns.';
