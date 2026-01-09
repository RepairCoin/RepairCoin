-- Add subscription reminder tracking columns to stripe_subscriptions
-- Tracks when expiration reminders have been sent (7 days, 3 days, 1 day before)

ALTER TABLE stripe_subscriptions
ADD COLUMN IF NOT EXISTS reminder_7d_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_7d_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_3d_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_3d_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_1d_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_1d_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_reminder_tracking
ON stripe_subscriptions(status, current_period_end, reminder_7d_sent, reminder_3d_sent, reminder_1d_sent)
WHERE status = 'active';

COMMENT ON COLUMN stripe_subscriptions.reminder_7d_sent IS 'Whether 7-day expiration reminder was sent';
COMMENT ON COLUMN stripe_subscriptions.reminder_3d_sent IS 'Whether 3-day expiration reminder was sent';
COMMENT ON COLUMN stripe_subscriptions.reminder_1d_sent IS 'Whether 1-day expiration reminder was sent';
