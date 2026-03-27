-- Migration: Create calendar integration system
-- Description: Add Google Calendar OAuth and event syncing support for shops
-- Date: 2026-03-24

-- ==================== SHOP CALENDAR CONNECTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS shop_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'google',

  -- OAuth tokens (encrypted at rest using AES-256-GCM)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,

  -- Google Calendar specific
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_account_email TEXT,

  -- Connection metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50),
  sync_error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_shop_provider UNIQUE (shop_id, provider),
  CONSTRAINT check_provider CHECK (provider IN ('google', 'outlook', 'apple')),
  CONSTRAINT check_sync_status CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'token_expired'))
);

-- Add comments for documentation
COMMENT ON TABLE shop_calendar_connections IS 'OAuth connections to external calendars (Google, Outlook, etc.) for appointment syncing';
COMMENT ON COLUMN shop_calendar_connections.shop_id IS 'Shop that owns this calendar connection';
COMMENT ON COLUMN shop_calendar_connections.provider IS 'Calendar provider: google, outlook, or apple';
COMMENT ON COLUMN shop_calendar_connections.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN shop_calendar_connections.refresh_token IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN shop_calendar_connections.token_expiry IS 'When the access token expires';
COMMENT ON COLUMN shop_calendar_connections.calendar_id IS 'Which calendar to sync to (primary or custom calendar ID)';
COMMENT ON COLUMN shop_calendar_connections.is_active IS 'Whether the connection is currently active';
COMMENT ON COLUMN shop_calendar_connections.last_sync_at IS 'Last time an event was successfully synced';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_calendar_shop_id ON shop_calendar_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_calendar_active ON shop_calendar_connections(shop_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shop_calendar_token_expiry ON shop_calendar_connections(token_expiry) WHERE is_active = true;

-- ==================== UPDATE SERVICE_ORDERS TABLE ====================

-- Add calendar sync columns to track event syncing
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS calendar_sync_status VARCHAR(50) DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS calendar_sync_error TEXT,
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN service_orders.google_calendar_event_id IS 'Google Calendar event ID for this appointment';
COMMENT ON COLUMN service_orders.calendar_sync_status IS 'Sync status: not_synced, synced, failed, deleted';
COMMENT ON COLUMN service_orders.calendar_sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN service_orders.calendar_synced_at IS 'When the event was last synced to calendar';

-- Add constraint (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_calendar_sync_status'
  ) THEN
    ALTER TABLE service_orders
    ADD CONSTRAINT check_calendar_sync_status
    CHECK (calendar_sync_status IN ('not_synced', 'synced', 'failed', 'deleted'));
  END IF;
END $$;

-- Create index for calendar event lookups
CREATE INDEX IF NOT EXISTS idx_service_orders_calendar_event
ON service_orders(google_calendar_event_id)
WHERE google_calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_calendar_sync_status
ON service_orders(calendar_sync_status)
WHERE calendar_sync_status != 'not_synced';

-- ==================== AUTO-UPDATE TRIGGER ====================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_calendar_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shop_calendar_connections_updated_at
  BEFORE UPDATE ON shop_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_calendar_connections_updated_at();

-- ==================== CLEANUP OLD CONNECTIONS ====================

-- Function to clean up disconnected calendar connections after 30 days
-- (Can be called via cron job or manually)
CREATE OR REPLACE FUNCTION cleanup_old_calendar_connections()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_calendar_connections
  WHERE is_active = false
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_calendar_connections() IS
'Deletes calendar connections that have been inactive for 30+ days';
