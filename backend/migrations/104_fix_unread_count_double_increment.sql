-- Migration 104: Fix unread count double-increment
--
-- Migration 079 installed an AFTER INSERT trigger that increments
-- unread_count_* on every new message AND sets last_message_preview via
-- LEFT(NEW.message_text, 100). The application code in
-- MessageService.incrementUnreadCount does the same two things again
-- immediately after. Every message send = +2 to the counter, and the
-- trigger's preview leaks encrypted ciphertext into the conversation row
-- before the app's encryption-aware preview overwrites it.
--
-- Fix: trim the trigger to only touch timestamps. The app stays in charge
-- of the counter and preview so it can produce encryption-safe and
-- attachment-aware preview text (e.g. "🔒 Locked message",
-- "Sent 2 attachment(s)"). Then reconcile existing drift by recomputing
-- each conversation's unread_count_* from the messages table.

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reconcile existing drift: recompute each conversation's unread counters
-- from the actual unread messages on the other side.
UPDATE conversations c
SET unread_count_customer = COALESCE((
  SELECT COUNT(*) FROM messages m
  WHERE m.conversation_id = c.conversation_id
    AND m.sender_type = 'shop'
    AND m.is_read = FALSE
    AND m.is_deleted = FALSE
), 0);

UPDATE conversations c
SET unread_count_shop = COALESCE((
  SELECT COUNT(*) FROM messages m
  WHERE m.conversation_id = c.conversation_id
    AND m.sender_type = 'customer'
    AND m.is_read = FALSE
    AND m.is_deleted = FALSE
), 0);
