-- 248: let an automation exist without a message (Custom Workflows W2).
--
-- Migration 247 made the ACTION explicit, but message_template stayed NOT NULL — so a rule whose
-- action is "issue 25 RCN" still could not be stored without inventing a message body for it. That
-- constraint was the last place the schema assumed every automation is a message.
--
-- Deliberately NOT done in 247: relaxing it there would have admitted NULLs while the TypeScript type
-- still declared `messageTemplate: string`. Both change together, here.
--
-- Existing rows are untouched — every one is a send_message rule with a template, and send_message
-- still refuses to post an empty body.

ALTER TABLE shop_auto_messages
  ALTER COLUMN message_template DROP NOT NULL;

COMMENT ON COLUMN shop_auto_messages.message_template IS
  'Message body for action_type=send_message. NULL for non-messaging actions (e.g. issue_reward), which configure themselves via action_payload.';
