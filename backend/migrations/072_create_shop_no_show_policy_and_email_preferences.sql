-- Migration: Create shop_no_show_policy and shop_email_preferences tables
-- Description: Add support for no-show policy configuration and email notification preferences per shop
-- Date: 2026-03-11

-- ==================== NO-SHOW POLICY TABLE ====================

CREATE TABLE IF NOT EXISTS shop_no_show_policy (
  shop_id TEXT PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  minimum_cancellation_hours INTEGER NOT NULL DEFAULT 4,
  auto_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_detection_delay_hours INTEGER NOT NULL DEFAULT 2,

  -- Penalty Tiers
  caution_threshold INTEGER NOT NULL DEFAULT 2,
  caution_advance_booking_hours INTEGER NOT NULL DEFAULT 24,
  deposit_threshold INTEGER NOT NULL DEFAULT 3,
  deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 25.00,
  deposit_advance_booking_hours INTEGER NOT NULL DEFAULT 48,
  deposit_reset_after_successful INTEGER NOT NULL DEFAULT 3,
  max_rcn_redemption_percent INTEGER NOT NULL DEFAULT 80,
  suspension_threshold INTEGER NOT NULL DEFAULT 5,
  suspension_duration_days INTEGER NOT NULL DEFAULT 30,

  -- Notifications
  send_email_tier1 BOOLEAN NOT NULL DEFAULT true,
  send_email_tier2 BOOLEAN NOT NULL DEFAULT true,
  send_email_tier3 BOOLEAN NOT NULL DEFAULT true,
  send_email_tier4 BOOLEAN NOT NULL DEFAULT true,
  send_sms_tier2 BOOLEAN NOT NULL DEFAULT false,
  send_sms_tier3 BOOLEAN NOT NULL DEFAULT true,
  send_sms_tier4 BOOLEAN NOT NULL DEFAULT true,
  send_push_notifications BOOLEAN NOT NULL DEFAULT true,

  -- Disputes
  allow_disputes BOOLEAN NOT NULL DEFAULT true,
  dispute_window_days INTEGER NOT NULL DEFAULT 7,
  auto_approve_first_offense BOOLEAN NOT NULL DEFAULT true,
  require_shop_review BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add comments for documentation
COMMENT ON TABLE shop_no_show_policy IS 'Shop-specific no-show penalty and booking restriction policies';
COMMENT ON COLUMN shop_no_show_policy.enabled IS 'Master switch to enable/disable no-show tracking for this shop';
COMMENT ON COLUMN shop_no_show_policy.grace_period_minutes IS 'Minutes after appointment time before customer is marked as no-show';
COMMENT ON COLUMN shop_no_show_policy.caution_threshold IS 'Number of no-shows before Tier 2 (Caution) restrictions apply';
COMMENT ON COLUMN shop_no_show_policy.deposit_threshold IS 'Number of no-shows before Tier 3 (Deposit Required) restrictions apply';
COMMENT ON COLUMN shop_no_show_policy.suspension_threshold IS 'Number of no-shows before Tier 4 (Suspended) restrictions apply';
COMMENT ON COLUMN shop_no_show_policy.max_rcn_redemption_percent IS 'Maximum percentage of service price that can be paid with RCN at Tiers 2-3';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_no_show_policy_enabled ON shop_no_show_policy(enabled);

-- ==================== EMAIL PREFERENCES TABLE ====================

CREATE TABLE IF NOT EXISTS shop_email_preferences (
  shop_id TEXT PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Booking & Appointment Notifications
  new_booking BOOLEAN NOT NULL DEFAULT true,
  booking_cancellation BOOLEAN NOT NULL DEFAULT true,
  booking_reschedule BOOLEAN NOT NULL DEFAULT true,
  appointment_reminder BOOLEAN NOT NULL DEFAULT true,
  no_show_alert BOOLEAN NOT NULL DEFAULT true,

  -- Customer Activity
  new_customer BOOLEAN NOT NULL DEFAULT true,
  customer_review BOOLEAN NOT NULL DEFAULT true,
  customer_message BOOLEAN NOT NULL DEFAULT true,

  -- Financial Notifications
  payment_received BOOLEAN NOT NULL DEFAULT true,
  refund_processed BOOLEAN NOT NULL DEFAULT true,
  subscription_renewal BOOLEAN NOT NULL DEFAULT true,
  subscription_expiring BOOLEAN NOT NULL DEFAULT true,

  -- Marketing & Promotions
  marketing_updates BOOLEAN NOT NULL DEFAULT false,
  feature_announcements BOOLEAN NOT NULL DEFAULT true,
  platform_news BOOLEAN NOT NULL DEFAULT false,

  -- Digest Settings
  daily_digest BOOLEAN NOT NULL DEFAULT false,
  weekly_report BOOLEAN NOT NULL DEFAULT true,
  monthly_report BOOLEAN NOT NULL DEFAULT false,

  -- Frequency Settings
  digest_time TEXT NOT NULL DEFAULT 'morning', -- 'morning', 'afternoon', 'evening'
  weekly_report_day TEXT NOT NULL DEFAULT 'monday', -- 'monday', 'friday'
  monthly_report_day INTEGER NOT NULL DEFAULT 1, -- 1-28

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_digest_time CHECK (digest_time IN ('morning', 'afternoon', 'evening')),
  CONSTRAINT check_weekly_day CHECK (weekly_report_day IN ('monday', 'friday')),
  CONSTRAINT check_monthly_day CHECK (monthly_report_day BETWEEN 1 AND 28)
);

-- Add comments for documentation
COMMENT ON TABLE shop_email_preferences IS 'Shop-specific email notification preferences';
COMMENT ON COLUMN shop_email_preferences.digest_time IS 'Preferred time of day for daily digest (morning=8am, afternoon=2pm, evening=6pm)';
COMMENT ON COLUMN shop_email_preferences.weekly_report_day IS 'Day of week to receive weekly performance report';
COMMENT ON COLUMN shop_email_preferences.monthly_report_day IS 'Day of month (1-28) to receive monthly insights';

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_no_show_policy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_no_show_policy_updated_at
  BEFORE UPDATE ON shop_no_show_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_no_show_policy_updated_at();

CREATE OR REPLACE FUNCTION update_shop_email_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_email_preferences_updated_at
  BEFORE UPDATE ON shop_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_email_preferences_updated_at();

-- ==================== SEED DEFAULT POLICIES FOR EXISTING SHOPS ====================

-- Insert default no-show policies for all existing shops
INSERT INTO shop_no_show_policy (shop_id)
SELECT shop_id FROM shops
ON CONFLICT (shop_id) DO NOTHING;

-- Insert default email preferences for all existing shops
INSERT INTO shop_email_preferences (shop_id)
SELECT shop_id FROM shops
ON CONFLICT (shop_id) DO NOTHING;

-- Migration complete
