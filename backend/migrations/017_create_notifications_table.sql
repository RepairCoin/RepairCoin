-- Migration: Create notifications table
-- Description: Adds notifications table for real-time customer-shop and customer-customer notifications

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_address VARCHAR(42) NOT NULL,
  receiver_address VARCHAR(42) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_address);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read ON notifications(receiver_address, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_address);

-- Comments
COMMENT ON TABLE notifications IS 'Stores notifications between customers and shops. No FK constraints since sender/receiver can be from customers or shops tables.';
COMMENT ON COLUMN notifications.sender_address IS 'Wallet address of sender (can be customer or shop)';
COMMENT ON COLUMN notifications.receiver_address IS 'Wallet address of receiver (can be customer or shop)';
COMMENT ON COLUMN notifications.notification_type IS 'Types: reward_issued, redemption_approval_request, redemption_approved, redemption_rejected, token_gifted';
COMMENT ON COLUMN notifications.metadata IS 'JSON metadata containing redemption_session_id, transaction_id, amount, etc.';
