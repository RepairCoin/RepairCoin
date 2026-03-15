-- Migration: 073_create_auto_messages
-- Description: Create tables for shop scheduled auto-messages
-- Date: 2026-03-10

-- Auto-message rule configuration
CREATE TABLE IF NOT EXISTS shop_auto_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(200) NOT NULL,
  message_template TEXT NOT NULL,

  -- Trigger type: 'schedule' or 'event'
  trigger_type VARCHAR(50) NOT NULL,

  -- For schedule-based triggers
  schedule_type VARCHAR(20),            -- 'daily' | 'weekly' | 'monthly'
  schedule_day_of_week INTEGER,         -- 0-6 for weekly (0=Sunday)
  schedule_day_of_month INTEGER,        -- 1-31 for monthly
  schedule_hour INTEGER DEFAULT 10,     -- Hour to send (0-23)

  -- For event-based triggers
  event_type VARCHAR(50),               -- 'booking_completed' | 'booking_cancelled' | 'first_visit' | 'inactive_30_days'
  delay_hours INTEGER DEFAULT 0,        -- Hours after event to send

  -- Targeting
  target_audience VARCHAR(50) DEFAULT 'all', -- 'all' | 'active' | 'inactive_30d' | 'has_balance' | 'completed_booking'

  is_active BOOLEAN DEFAULT true,
  max_sends_per_customer INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track what's been sent to prevent duplicates
CREATE TABLE IF NOT EXISTS auto_message_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_message_id UUID NOT NULL REFERENCES shop_auto_messages(id),
  shop_id VARCHAR(100) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  conversation_id VARCHAR(100),
  message_id VARCHAR(100),
  trigger_reference VARCHAR(255),       -- For event-based: the order_id or event that triggered it
  status VARCHAR(20) DEFAULT 'sent',    -- 'pending' | 'sent' | 'failed'
  scheduled_send_at TIMESTAMPTZ,        -- For delayed event-based sends
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_messages_shop ON shop_auto_messages(shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_sends_lookup ON auto_message_sends(auto_message_id, customer_address);
CREATE INDEX IF NOT EXISTS idx_auto_sends_shop ON auto_message_sends(shop_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_auto_sends_pending ON auto_message_sends(status, scheduled_send_at) WHERE status = 'pending';
