-- Migration 056: Create Messaging System
-- Created: 2026-01-06
-- Description: Creates conversations and messages tables for customer-shop messaging

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
-- Stores conversation threads between customers and shops
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id VARCHAR(255) PRIMARY KEY,
  customer_address VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,

  -- Metadata
  last_message_at TIMESTAMP,
  last_message_preview TEXT,

  -- Unread counts (denormalized for performance)
  unread_count_customer INTEGER DEFAULT 0,
  unread_count_shop INTEGER DEFAULT 0,

  -- Status
  is_archived_customer BOOLEAN DEFAULT FALSE,
  is_archived_shop BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_by VARCHAR(20), -- 'customer' or 'shop'
  blocked_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign keys
  FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Unique constraint: one conversation per customer-shop pair
  UNIQUE(customer_address, shop_id)
);

-- Indexes for conversations
CREATE INDEX idx_conversations_customer ON conversations(customer_address, updated_at DESC);
CREATE INDEX idx_conversations_shop ON conversations(shop_id, updated_at DESC);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
-- Stores individual messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  message_id VARCHAR(255) PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,

  -- Sender info
  sender_address VARCHAR(255) NOT NULL,
  sender_type VARCHAR(20) NOT NULL, -- 'customer' or 'shop'

  -- Message content
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'booking_link', 'service_link', 'system'

  -- Attachments (optional, for future)
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Can store booking_id, service_id, etc.

  -- Read status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  -- Delivery status
  is_delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP,

  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign keys
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,

  -- Check constraints
  CONSTRAINT check_sender_type CHECK (sender_type IN ('customer', 'shop')),
  CONSTRAINT check_message_type CHECK (message_type IN ('text', 'booking_link', 'service_link', 'system'))
);

-- Indexes for messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_address, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================================================
-- TYPING INDICATORS TABLE
-- ============================================================================
-- Stores active typing indicators (ephemeral data, cleaned up periodically)
CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id VARCHAR(255) NOT NULL,
  user_address VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL, -- 'customer' or 'shop'
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 seconds'),

  PRIMARY KEY (conversation_id, user_address),
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,

  CONSTRAINT check_user_type CHECK (user_type IN ('customer', 'shop'))
);

-- Index for typing indicators
CREATE INDEX idx_typing_indicators_conversation ON typing_indicators(conversation_id, expires_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update conversation timestamp when message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.message_text, 100),
    updated_at = NOW(),
    -- Increment unread count for receiver
    unread_count_customer = CASE
      WHEN NEW.sender_type = 'shop' THEN unread_count_customer + 1
      ELSE unread_count_customer
    END,
    unread_count_shop = CASE
      WHEN NEW.sender_type = 'customer' THEN unread_count_shop + 1
      ELSE unread_count_shop
    END
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update conversation on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Function: Reset unread count when messages are marked as read
CREATE OR REPLACE FUNCTION reset_unread_count_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    UPDATE conversations
    SET
      unread_count_customer = CASE
        WHEN NEW.sender_type = 'shop' THEN GREATEST(0, unread_count_customer - 1)
        ELSE unread_count_customer
      END,
      unread_count_shop = CASE
        WHEN NEW.sender_type = 'customer' THEN GREATEST(0, unread_count_shop - 1)
        ELSE unread_count_shop
      END,
      updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Reset unread count when message marked as read
DROP TRIGGER IF EXISTS trigger_reset_unread_count ON messages;
CREATE TRIGGER trigger_reset_unread_count
  AFTER UPDATE ON messages
  FOR EACH ROW
  WHEN (NEW.is_read IS DISTINCT FROM OLD.is_read)
  EXECUTE FUNCTION reset_unread_count_on_read();

-- Function: Clean up expired typing indicators (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE conversations IS 'Conversation threads between customers and shops';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE typing_indicators IS 'Active typing indicators (ephemeral, auto-cleaned)';

COMMENT ON COLUMN conversations.unread_count_customer IS 'Number of unread messages for customer';
COMMENT ON COLUMN conversations.unread_count_shop IS 'Number of unread messages for shop';
COMMENT ON COLUMN messages.metadata IS 'Additional data like booking_id, service_id for contextual messages';
COMMENT ON COLUMN messages.message_type IS 'Message type: text (default), booking_link, service_link, or system';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================
-- No initial data needed

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
