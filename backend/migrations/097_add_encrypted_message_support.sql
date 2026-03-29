-- Add encrypted message support
-- Adds is_encrypted column and updates message_type constraint

-- Add is_encrypted boolean column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Drop existing message_type check constraint if it exists
DO $$ BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_message_type;
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
EXCEPTION WHEN undefined_object THEN
  -- Constraint doesn't exist, continue
END $$;

-- Add updated constraint with 'encrypted' type
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'booking_link', 'service_link', 'system', 'encrypted'));

-- Partial index for fast lookup of encrypted messages in a conversation
CREATE INDEX IF NOT EXISTS idx_messages_encrypted
  ON messages(conversation_id, is_encrypted) WHERE is_encrypted = TRUE;
