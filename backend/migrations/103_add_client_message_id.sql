-- Migration: Add client_message_id for optimistic send idempotency
-- The frontend generates a UUID per send and retries on failure. The backend
-- uses this column to dedupe retries so a message is inserted at most once.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(64);

-- Partial unique index: scoped to (conversation_id, client_message_id) so two
-- different conversations can independently reuse IDs if they ever collide.
-- WHERE clause skips existing rows (client_message_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_message_id
  ON messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

COMMENT ON COLUMN messages.client_message_id IS 'Client-generated UUID used to dedupe optimistic-send retries. Nullable for legacy/server-initiated messages.';
