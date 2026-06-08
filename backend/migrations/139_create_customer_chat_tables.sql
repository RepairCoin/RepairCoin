-- Migration 136: Create Customer AI Chat Tables
-- Creates tables for customer-facing diagnostic AI chat sessions

-- Customer chat sessions
CREATE TABLE IF NOT EXISTS ai_customer_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address VARCHAR(42), -- Optional - for logged in customers
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customer chat messages
CREATE TABLE IF NOT EXISTS ai_customer_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_customer_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB, -- Services, cost estimates, device info, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_chat_sessions_token
  ON ai_customer_chat_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_customer_chat_sessions_expires
  ON ai_customer_chat_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_chat_messages_session
  ON ai_customer_chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_chat_messages_created
  ON ai_customer_chat_messages(created_at);

-- Add comment
COMMENT ON TABLE ai_customer_chat_sessions IS 'Customer diagnostic AI chat sessions - public, no auth required';
COMMENT ON TABLE ai_customer_chat_messages IS 'Messages in customer diagnostic chats with AI recommendations';
