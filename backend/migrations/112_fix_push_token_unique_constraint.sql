-- Migration: Ensure unique constraint on expo_push_token exists
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- The ON CONFLICT (expo_push_token) in PushTokenRepository requires this constraint.

-- Step 1: Remove duplicates keeping only the most recently used row per token
DELETE FROM device_push_tokens a
USING device_push_tokens b
WHERE a.expo_push_token = b.expo_push_token
  AND a.expo_push_token IS NOT NULL
  AND a.id <> b.id
  AND (a.last_used_at < b.last_used_at OR (a.last_used_at = b.last_used_at AND a.created_at < b.created_at));

-- Step 2: Add partial unique index to handle NULLs (web tokens have NULL expo_push_token)
DROP INDEX IF EXISTS idx_unique_expo_push_token;
CREATE UNIQUE INDEX idx_unique_expo_push_token
  ON device_push_tokens (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- Step 3: Drop the old table-level constraint if it exists (it may conflict)
ALTER TABLE device_push_tokens DROP CONSTRAINT IF EXISTS unique_device_token;
