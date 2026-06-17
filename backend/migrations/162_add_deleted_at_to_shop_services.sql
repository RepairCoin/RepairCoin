-- Migration 162: Add deleted_at to shop_services (true soft delete)
-- (Versions 155-161 are already taken on the shared DigitalOcean DB by the
--  ads/billing branch; the runner dedups by numeric version, so we use 162.)
--
-- Previously "deleting" a service only set active = false, which is identical to
-- the Deactivate toggle. The shop's own management list shows inactive services,
-- so a "deleted" service still appeared there — delete looked like a no-op.
--
-- deleted_at gives a dedicated soft-delete marker that is distinct from active.
-- deleteService now sets it; every service read path excludes rows where
-- deleted_at IS NOT NULL. active is still set false on delete as a belt-and-suspenders
-- so existing active-only (customer-facing) queries keep excluding deleted rows too.

ALTER TABLE shop_services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Speeds up the "exclude deleted" filter applied to every service read.
CREATE INDEX IF NOT EXISTS idx_shop_services_deleted_at
  ON shop_services (deleted_at)
  WHERE deleted_at IS NULL;
