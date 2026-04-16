-- Migration: Add Web Push (VAPID) support to device_push_tokens
-- Extends the push notification system to support browser-based web push alongside mobile (Expo)

-- 1. Add 'web' to device_type CHECK constraint
ALTER TABLE device_push_tokens DROP CONSTRAINT device_push_tokens_device_type_check;
ALTER TABLE device_push_tokens ADD CONSTRAINT device_push_tokens_device_type_check
  CHECK (device_type IN ('ios', 'android', 'web'));

-- 2. Add JSONB column for web push subscription data
-- Stores: { endpoint: string, keys: { p256dh: string, auth: string } }
ALTER TABLE device_push_tokens ADD COLUMN web_push_subscription JSONB;

-- 3. Make expo_push_token nullable (web tokens don't have one)
ALTER TABLE device_push_tokens ALTER COLUMN expo_push_token DROP NOT NULL;

-- 4. Add integrity check: mobile rows need expo_push_token, web rows need web_push_subscription
ALTER TABLE device_push_tokens ADD CONSTRAINT push_token_type_check CHECK (
  (device_type IN ('ios', 'android') AND expo_push_token IS NOT NULL)
  OR
  (device_type = 'web' AND web_push_subscription IS NOT NULL)
);

-- 5. Unique index on web push endpoint to prevent duplicate subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_web_endpoint
  ON device_push_tokens ((web_push_subscription->>'endpoint'))
  WHERE device_type = 'web';

COMMENT ON COLUMN device_push_tokens.web_push_subscription IS 'Web Push subscription JSON (endpoint + VAPID keys). Only for device_type=web.';
