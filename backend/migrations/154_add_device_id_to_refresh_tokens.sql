-- Migration 154: Add device_id to refresh_tokens
--
-- "One active session per device" previously keyed off user_agent, but two
-- browser contexts on the same machine (e.g. normal + incognito) share an
-- identical user_agent, so logging into one would revoke the other.
--
-- device_id is a stable per-browser-context id generated client-side and stored
-- in localStorage. Incognito has isolated storage, so it gets its own id and is
-- correctly treated as a distinct device. user_agent stays as the fallback for
-- clients that don't send a device id (older web, native apps).

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

-- Speeds up the same-device revoke/dedupe lookups (user_address + device_id).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_device
  ON refresh_tokens(user_address, device_id)
  WHERE device_id IS NOT NULL;

COMMENT ON COLUMN refresh_tokens.device_id IS 'Stable per-browser-context id (localStorage) used to keep one active session per device; falls back to user_agent when absent';
