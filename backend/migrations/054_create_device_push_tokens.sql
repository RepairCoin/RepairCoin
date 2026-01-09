-- Migration: Create device_push_tokens table for Expo Push Notifications
-- This table stores push notification tokens for mobile devices

CREATE TABLE IF NOT EXISTS device_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    expo_push_token VARCHAR(255) NOT NULL,
    device_id VARCHAR(255),
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android')),
    device_name VARCHAR(100),
    app_version VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each push token should be unique across all devices
    CONSTRAINT unique_device_token UNIQUE (expo_push_token),
    -- A user can only have one token per device (upsert on device_id)
    CONSTRAINT unique_user_device UNIQUE (wallet_address, device_id)
);

-- Index for looking up all tokens for a user
CREATE INDEX IF NOT EXISTS idx_push_tokens_wallet ON device_push_tokens(wallet_address);

-- Index for looking up active tokens for a user (common query)
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON device_push_tokens(wallet_address, is_active) WHERE is_active = TRUE;

-- Index for looking up by token (for deactivation)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON device_push_tokens(expo_push_token);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_last_used ON device_push_tokens(last_used_at) WHERE is_active = FALSE;

-- Add comment for documentation
COMMENT ON TABLE device_push_tokens IS 'Stores Expo push notification tokens for mobile devices. Supports multiple devices per user.';
COMMENT ON COLUMN device_push_tokens.wallet_address IS 'User wallet address (lowercase)';
COMMENT ON COLUMN device_push_tokens.expo_push_token IS 'Expo push token in format ExponentPushToken[xxx]';
COMMENT ON COLUMN device_push_tokens.device_id IS 'Unique device identifier from expo-constants';
COMMENT ON COLUMN device_push_tokens.device_type IS 'Platform: ios or android';
COMMENT ON COLUMN device_push_tokens.is_active IS 'FALSE when token is invalidated or user logged out';
