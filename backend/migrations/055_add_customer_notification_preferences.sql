-- Migration: Add customer notification preferences
-- Date: 2026-01-02
-- Description: Creates table for storing customer notification preferences
--              for appointment reminders (email, in-app, SMS channels and timing)

-- =====================================================
-- 1. Create notification preferences table
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address VARCHAR(255) NOT NULL,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,  -- Opt-in for SMS (Phase 3)
  in_app_enabled BOOLEAN DEFAULT true,

  -- Reminder timing preferences
  reminder_24h_enabled BOOLEAN DEFAULT true,
  reminder_2h_enabled BOOLEAN DEFAULT true,
  reminder_30m_enabled BOOLEAN DEFAULT false,  -- Opt-in for 30min (future)

  -- Quiet hours (optional - notifications paused during these times)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT NULL,  -- e.g., '22:00'
  quiet_hours_end TIME DEFAULT NULL,    -- e.g., '08:00'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure one preference record per customer
  CONSTRAINT unique_customer_preferences UNIQUE(customer_address)
);

-- =====================================================
-- 2. Create index for efficient lookups
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notification_prefs_customer
  ON customer_notification_preferences(customer_address);

-- =====================================================
-- 3. Create trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_prefs_updated_at ON customer_notification_preferences;
CREATE TRIGGER trigger_notification_prefs_updated_at
  BEFORE UPDATE ON customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_prefs_updated_at();

-- =====================================================
-- 4. Add comments
-- =====================================================
COMMENT ON TABLE customer_notification_preferences IS 'Customer preferences for appointment reminder notifications';
COMMENT ON COLUMN customer_notification_preferences.email_enabled IS 'Whether to send email reminders';
COMMENT ON COLUMN customer_notification_preferences.sms_enabled IS 'Whether to send SMS reminders (requires verified phone)';
COMMENT ON COLUMN customer_notification_preferences.in_app_enabled IS 'Whether to send in-app notifications';
COMMENT ON COLUMN customer_notification_preferences.reminder_24h_enabled IS 'Send reminder 24 hours before appointment';
COMMENT ON COLUMN customer_notification_preferences.reminder_2h_enabled IS 'Send reminder 2 hours before appointment';
COMMENT ON COLUMN customer_notification_preferences.reminder_30m_enabled IS 'Send reminder 30 minutes before appointment';
COMMENT ON COLUMN customer_notification_preferences.quiet_hours_enabled IS 'Whether quiet hours are active';
COMMENT ON COLUMN customer_notification_preferences.quiet_hours_start IS 'Start of quiet hours (no notifications)';
COMMENT ON COLUMN customer_notification_preferences.quiet_hours_end IS 'End of quiet hours';
