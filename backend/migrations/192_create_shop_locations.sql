-- 192 — Multi-location management (Business tier), Slice 1. A shop (the billing / wallet /
-- subscription identity) can own N physical locations. In this slice a location is a managed
-- address book entry (name, address, geo, phone, primary flag); bookings/services are wired to a
-- location in a later slice. Gated via featureTiers 'multiLocation' = business. Idempotent.
CREATE TABLE IF NOT EXISTS shop_locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  location_city     VARCHAR(100),
  location_state    VARCHAR(100),
  location_zip_code VARCHAR(20),
  location_lat      NUMERIC(10,8),
  location_lng      NUMERIC(11,8),
  phone             VARCHAR(50),
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_locations_shop ON shop_locations (shop_id);

-- At most one primary location per shop (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_locations_primary
  ON shop_locations (shop_id) WHERE is_primary;

-- Backfill: seed each existing shop's current address as its primary location so the Locations
-- tab is pre-populated. One-time and idempotent — only inserts for shops that have no location yet.
INSERT INTO shop_locations (
  shop_id, name, address, location_city, location_state, location_zip_code,
  location_lat, location_lng, phone, is_primary, active
)
SELECT
  s.shop_id, s.name, s.address, s.location_city, s.location_state, s.location_zip_code,
  s.location_lat, s.location_lng, s.phone, true, true
FROM shops s
WHERE NOT EXISTS (SELECT 1 FROM shop_locations l WHERE l.shop_id = s.shop_id);
