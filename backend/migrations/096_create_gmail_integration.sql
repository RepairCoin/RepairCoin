-- Migration: Create Gmail integration system
-- Description: Add Gmail OAuth and email sending support for shops
-- Date: 2026-03-25

-- ==================== SHOP GMAIL CONNECTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS shop_gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- OAuth tokens (encrypted at rest using AES-256-GCM)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,

  -- Gmail account info
  email_address TEXT NOT NULL,
  display_name TEXT,

  -- Connection metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_email_sent_at TIMESTAMPTZ,
  total_emails_sent INTEGER NOT NULL DEFAULT 0,
  last_sync_status VARCHAR(50),
  sync_error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_shop_gmail UNIQUE (shop_id),
  CONSTRAINT check_sync_status CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'token_expired'))
);

-- Add comments for documentation
COMMENT ON TABLE shop_gmail_connections IS 'OAuth connections to Gmail for sending emails to customers';
COMMENT ON COLUMN shop_gmail_connections.shop_id IS 'Shop that owns this Gmail connection';
COMMENT ON COLUMN shop_gmail_connections.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN shop_gmail_connections.refresh_token IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN shop_gmail_connections.token_expiry IS 'When the access token expires';
COMMENT ON COLUMN shop_gmail_connections.email_address IS 'Connected Gmail email address';
COMMENT ON COLUMN shop_gmail_connections.is_active IS 'Whether the connection is currently active';
COMMENT ON COLUMN shop_gmail_connections.total_emails_sent IS 'Total number of emails sent through this connection';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_gmail_shop_id ON shop_gmail_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_gmail_active ON shop_gmail_connections(shop_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shop_gmail_token_expiry ON shop_gmail_connections(token_expiry) WHERE is_active = true;

-- ==================== SENT EMAILS LOG TABLE ====================

CREATE TABLE IF NOT EXISTS sent_emails_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Email details
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT, -- First 200 chars of body

  -- Related entities
  order_id TEXT,
  customer_address TEXT,

  -- Email type
  email_type VARCHAR(50) NOT NULL, -- 'booking_confirmation', 'reminder', 'promotional', 'support', 'manual'

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  gmail_message_id TEXT, -- Gmail's message ID for tracking

  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_email_type CHECK (email_type IN ('booking_confirmation', 'reminder', 'promotional', 'support', 'manual', 'cancellation', 'reschedule')),
  CONSTRAINT check_email_status CHECK (status IN ('sent', 'failed', 'bounced'))
);

-- Add comments
COMMENT ON TABLE sent_emails_log IS 'Log of all emails sent through Gmail integration';
COMMENT ON COLUMN sent_emails_log.email_type IS 'Type of email sent';
COMMENT ON COLUMN sent_emails_log.status IS 'Delivery status of the email';
COMMENT ON COLUMN sent_emails_log.gmail_message_id IS 'Gmail message ID for tracking';

-- Create indexes for queries
CREATE INDEX IF NOT EXISTS idx_sent_emails_shop_id ON sent_emails_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_order_id ON sent_emails_log(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_emails_customer ON sent_emails_log(customer_address) WHERE customer_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_at ON sent_emails_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_emails_type ON sent_emails_log(shop_id, email_type);

-- ==================== AUTO-UPDATE TRIGGER ====================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_gmail_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shop_gmail_connections_updated_at
  BEFORE UPDATE ON shop_gmail_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_gmail_connections_updated_at();

-- ==================== CLEANUP OLD CONNECTIONS ====================

-- Function to clean up disconnected Gmail connections after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_gmail_connections()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_gmail_connections
  WHERE is_active = false
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_gmail_connections() IS
'Deletes Gmail connections that have been inactive for 30+ days';
