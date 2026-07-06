-- 194 — Multi-location Slice 3: per-location operating hours (and holiday/concurrency config).
-- Adds a nullable location_id to the three scheduling-config tables. A NULL location_id row is the
-- shop-level default/fallback (today's behavior, unchanged); a non-NULL row is a per-branch override.
-- Resolution is "prefer the branch row, fall back to the shop row" — so nothing breaks for shops
-- that never customize a branch. Idempotent.

-- ==================== shop_availability (weekly operating hours) ====================
ALTER TABLE shop_availability
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE CASCADE;

-- Old constraint forced one row per (shop, day); replace with two partial unique indexes so
-- shop-level rows and per-location rows each stay unique without colliding.
ALTER TABLE shop_availability
  DROP CONSTRAINT IF EXISTS shop_availability_shop_id_day_of_week_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_availability_shop_day
  ON shop_availability (shop_id, day_of_week) WHERE location_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_availability_loc_day
  ON shop_availability (shop_id, location_id, day_of_week) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_availability_location ON shop_availability (location_id);

-- ==================== shop_time_slot_config (slot / concurrency config) ====================
ALTER TABLE shop_time_slot_config
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE CASCADE;

-- Drop both the inline UNIQUE (migration 008) and the named one (migration 070).
ALTER TABLE shop_time_slot_config
  DROP CONSTRAINT IF EXISTS shop_time_slot_config_shop_id_key;
ALTER TABLE shop_time_slot_config
  DROP CONSTRAINT IF EXISTS shop_time_slot_config_shop_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_time_slot_config_shop
  ON shop_time_slot_config (shop_id) WHERE location_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_time_slot_config_loc
  ON shop_time_slot_config (shop_id, location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_slot_config_location ON shop_time_slot_config (location_id);

-- ==================== shop_date_overrides (holidays / special days) ====================
ALTER TABLE shop_date_overrides
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE CASCADE;

ALTER TABLE shop_date_overrides
  DROP CONSTRAINT IF EXISTS shop_date_overrides_shop_id_override_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_date_overrides_shop_date
  ON shop_date_overrides (shop_id, override_date) WHERE location_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_date_overrides_loc_date
  ON shop_date_overrides (shop_id, location_id, override_date) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_date_overrides_location ON shop_date_overrides (location_id);
