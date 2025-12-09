-- Migration: Create idempotency_keys table for duplicate request prevention
-- This prevents duplicate reward issuance when clients retry failed/timeout requests

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL,
    shop_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(100) NOT NULL DEFAULT 'issue-reward',
    request_hash VARCHAR(64), -- SHA256 hash of request body for additional validation
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Composite unique constraint to prevent duplicates per shop/endpoint
    CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, shop_id, endpoint)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup
ON idempotency_keys (idempotency_key, shop_id, endpoint);

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
ON idempotency_keys (expires_at);

-- Add comment explaining the table
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys for preventing duplicate API requests';
COMMENT ON COLUMN idempotency_keys.idempotency_key IS 'Client-provided unique key (typically UUID)';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA256 hash of request body to detect conflicting requests with same key';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Keys expire after 24 hours and can be cleaned up';

-- Function to clean up expired idempotency keys (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Removes expired idempotency keys. Call periodically via cron or scheduled task.';
