-- Migration: Enforce one web push row per wallet
-- Collapses legacy duplicates, then adds a partial unique index so the
-- database enforces the invariant going forward.

-- Step A: For each wallet with multiple web rows, keep only the newest
-- and delete the rest. "Newest" by last_used_at DESC, created_at DESC tiebreaker.
DELETE FROM device_push_tokens
WHERE device_type = 'web'
  AND id NOT IN (
    SELECT DISTINCT ON (wallet_address) id
    FROM device_push_tokens
    WHERE device_type = 'web'
    ORDER BY wallet_address, last_used_at DESC, created_at DESC
  );

-- Step B: Partial unique index — one web row per wallet
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_wallet_web
  ON device_push_tokens (wallet_address)
  WHERE device_type = 'web';

COMMENT ON INDEX idx_push_tokens_wallet_web IS
  'One web push row per wallet. Registrations UPSERT this row.';
