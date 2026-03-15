-- Migration: Create general notification preferences
-- Date: 2025-02-25
-- Description: Creates table for storing general notification preferences across all user types
--              (customer, shop, admin) covering platform updates, security, transactions, etc.

-- =====================================================
-- 1. Create general notification preferences table
-- =====================================================
CREATE TABLE IF NOT EXISTS general_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'shop', 'admin')),

  -- Platform & System Updates
  platform_updates BOOLEAN DEFAULT true,
  maintenance_alerts BOOLEAN DEFAULT true,
  new_features BOOLEAN DEFAULT false,

  -- Account & Security (always on for security_alerts)
  security_alerts BOOLEAN DEFAULT true,
  login_notifications BOOLEAN DEFAULT false,
  password_changes BOOLEAN DEFAULT true,

  -- Tokens & Rewards (Customer only)
  token_received BOOLEAN DEFAULT true,
  token_redeemed BOOLEAN DEFAULT true,
  rewards_earned BOOLEAN DEFAULT true,

  -- Orders & Services (Customer only)
  order_updates BOOLEAN DEFAULT true,
  service_approved BOOLEAN DEFAULT true,
  review_requests BOOLEAN DEFAULT false,

  -- Shop Operations (Shop only)
  new_orders BOOLEAN DEFAULT true,
  customer_messages BOOLEAN DEFAULT true,
  low_token_balance BOOLEAN DEFAULT true,
  subscription_reminders BOOLEAN DEFAULT true,

  -- Admin Alerts (Admin only)
  system_alerts BOOLEAN DEFAULT true,
  user_reports BOOLEAN DEFAULT true,
  treasury_changes BOOLEAN DEFAULT true,

  -- Marketing & Promotions (All users)
  promotions BOOLEAN DEFAULT false,
  newsletter BOOLEAN DEFAULT false,
  surveys BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure one preference record per user
  CONSTRAINT unique_user_general_preferences UNIQUE(user_address, user_type)
);

-- =====================================================
-- 2. Create indexes for efficient lookups
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_general_notif_prefs_user_address
  ON general_notification_preferences(user_address);

CREATE INDEX IF NOT EXISTS idx_general_notif_prefs_user_type
  ON general_notification_preferences(user_type);

CREATE INDEX IF NOT EXISTS idx_general_notif_prefs_composite
  ON general_notification_preferences(user_address, user_type);

-- =====================================================
-- 3. Create trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_general_notif_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_general_notif_prefs_updated_at ON general_notification_preferences;
CREATE TRIGGER trigger_general_notif_prefs_updated_at
  BEFORE UPDATE ON general_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_general_notif_prefs_updated_at();

-- =====================================================
-- 4. Add comments
-- =====================================================
COMMENT ON TABLE general_notification_preferences IS 'General notification preferences for all user types';
COMMENT ON COLUMN general_notification_preferences.user_type IS 'Type of user: customer, shop, or admin';

-- Platform & System
COMMENT ON COLUMN general_notification_preferences.platform_updates IS 'Important RepairCoin platform updates';
COMMENT ON COLUMN general_notification_preferences.maintenance_alerts IS 'Scheduled maintenance and downtime notices';
COMMENT ON COLUMN general_notification_preferences.new_features IS 'New feature launches';

-- Account & Security
COMMENT ON COLUMN general_notification_preferences.security_alerts IS 'Critical security notifications (always on)';
COMMENT ON COLUMN general_notification_preferences.login_notifications IS 'Login activity alerts';
COMMENT ON COLUMN general_notification_preferences.password_changes IS 'Password change confirmations';

-- Tokens & Rewards (Customer)
COMMENT ON COLUMN general_notification_preferences.token_received IS 'When RCN tokens are earned';
COMMENT ON COLUMN general_notification_preferences.token_redeemed IS 'When tokens are redeemed';
COMMENT ON COLUMN general_notification_preferences.rewards_earned IS 'Special rewards and bonuses';

-- Orders & Services (Customer)
COMMENT ON COLUMN general_notification_preferences.order_updates IS 'Service booking status changes';
COMMENT ON COLUMN general_notification_preferences.service_approved IS 'Shop approvals';
COMMENT ON COLUMN general_notification_preferences.review_requests IS 'Review reminders';

-- Shop Operations (Shop)
COMMENT ON COLUMN general_notification_preferences.new_orders IS 'New customer bookings';
COMMENT ON COLUMN general_notification_preferences.customer_messages IS 'Direct messages from customers';
COMMENT ON COLUMN general_notification_preferences.low_token_balance IS 'Low RCN balance alerts';
COMMENT ON COLUMN general_notification_preferences.subscription_reminders IS 'Subscription renewal reminders';

-- Admin Alerts (Admin)
COMMENT ON COLUMN general_notification_preferences.system_alerts IS 'Critical system issues';
COMMENT ON COLUMN general_notification_preferences.user_reports IS 'User reports and support tickets';
COMMENT ON COLUMN general_notification_preferences.treasury_changes IS 'Large transactions and treasury updates';

-- Marketing (All)
COMMENT ON COLUMN general_notification_preferences.promotions IS 'Special deals and offers';
COMMENT ON COLUMN general_notification_preferences.newsletter IS 'Monthly newsletters';
COMMENT ON COLUMN general_notification_preferences.surveys IS 'Feedback surveys';
