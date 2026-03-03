-- Migration: Add subscription-specific notification preference fields
-- Created: March 3, 2026
-- Purpose: Add granular subscription notification controls for shops

-- Add subscription-specific notification fields to general_notification_preferences table
ALTER TABLE general_notification_preferences
ADD COLUMN IF NOT EXISTS payment_reminders BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS payment_failure_alerts BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS subscription_renewal_notices BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS subscription_expiration_warnings BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS payment_method_expiring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS billing_receipt_notifications BOOLEAN DEFAULT TRUE;

-- Add comment explaining the new fields
COMMENT ON COLUMN general_notification_preferences.payment_reminders IS 'Send reminder notifications before payment is due';
COMMENT ON COLUMN general_notification_preferences.payment_failure_alerts IS 'Alert when subscription payment fails';
COMMENT ON COLUMN general_notification_preferences.subscription_renewal_notices IS 'Notify before subscription renews';
COMMENT ON COLUMN general_notification_preferences.subscription_expiration_warnings IS 'Warn before subscription expires';
COMMENT ON COLUMN general_notification_preferences.payment_method_expiring IS 'Alert when payment method is about to expire';
COMMENT ON COLUMN general_notification_preferences.billing_receipt_notifications IS 'Send receipts for successful payments';

-- Update trigger remains the same (updated_at auto-updates on any field change)
