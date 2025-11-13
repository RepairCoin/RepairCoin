-- Migration: Add revoked_by_admin column to distinguish admin revocations from user logouts
-- This prevents normal logouts from blocking immediate re-login

-- Add revoked_by_admin column (defaults to false for existing rows)
ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS revoked_by_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for efficient querying of admin revocations
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_revocations
ON refresh_tokens(user_address, revoked_by_admin, revoked_at)
WHERE revoked = true AND revoked_by_admin = true;

-- Update existing revoked tokens to be marked as user-initiated (since we don't have historical data)
-- This ensures existing revocations don't block logins after this migration
UPDATE refresh_tokens
SET revoked_by_admin = false
WHERE revoked = true AND revoked_by_admin IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN refresh_tokens.revoked_by_admin IS 'True if token was revoked by admin, false if revoked by user logout. Only admin revocations trigger login cooldown.';
