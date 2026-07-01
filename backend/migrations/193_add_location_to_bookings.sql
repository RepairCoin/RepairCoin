-- 193 — Multi-location Slice 2: location-scoped bookings. Tag each booking with the location it is
-- for, and add a paid-Business entitlement flag that gates multi-location behavior (excludes trial
-- and post-downgrade). Idempotent.

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_location ON service_orders (location_id);

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS multi_location_active BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing bookings to each shop's primary location.
UPDATE service_orders o
SET location_id = l.id
FROM shop_locations l
WHERE l.shop_id = o.shop_id AND l.is_primary = true AND o.location_id IS NULL;

-- Backfill entitlement: an active Business (or legacy top-tier) subscription that is not trialing.
UPDATE shops s
SET multi_location_active = true
WHERE EXISTS (
  SELECT 1 FROM shop_subscriptions ss
  WHERE ss.shop_id = s.shop_id
    AND ss.status = 'active' AND ss.is_active = true
    AND ss.subscription_type IN ('business', 'standard', 'premium', 'custom')
)
AND NOT EXISTS (
  SELECT 1 FROM stripe_subscriptions st
  WHERE st.shop_id = s.shop_id AND st.status = 'trialing'
);
