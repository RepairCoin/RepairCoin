-- Migration: Create subscription enforcement log table
-- This table tracks warnings and cancellations for overdue subscriptions

CREATE TABLE IF NOT EXISTS subscription_enforcement_log (
    id SERIAL PRIMARY KEY,
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    last_warning_at TIMESTAMP WITH TIME ZONE,
    warning_count INTEGER DEFAULT 0,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_enforcement_log_subscription_id
    ON subscription_enforcement_log(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_enforcement_log_warning_count
    ON subscription_enforcement_log(warning_count)
    WHERE warning_count > 0;

CREATE INDEX IF NOT EXISTS idx_subscription_enforcement_log_cancelled
    ON subscription_enforcement_log(cancelled_at)
    WHERE cancelled_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE subscription_enforcement_log IS 'Tracks subscription enforcement actions (warnings, cancellations) for overdue subscriptions';
COMMENT ON COLUMN subscription_enforcement_log.stripe_subscription_id IS 'Reference to stripe_subscriptions.stripe_subscription_id';
COMMENT ON COLUMN subscription_enforcement_log.last_warning_at IS 'When the last warning email was sent';
COMMENT ON COLUMN subscription_enforcement_log.warning_count IS 'Number of warning emails sent';
COMMENT ON COLUMN subscription_enforcement_log.cancelled_at IS 'When the subscription was auto-cancelled';
COMMENT ON COLUMN subscription_enforcement_log.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN subscription_enforcement_log.details IS 'Additional details about enforcement actions';

-- Record migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('043', 'create_subscription_enforcement_log', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
