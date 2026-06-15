-- 147_add_ad_lead_id_to_service_orders.sql
--
-- Ads attribution: link a service order back to the ad lead that produced it.
-- Backwards-compatible — existing rows stay NULL. Must run AFTER 146 (ad_leads).
-- See docs/tasks/strategy/ads-system/stage-0-scope.md.

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS ad_lead_id UUID REFERENCES ad_leads(id);

CREATE INDEX IF NOT EXISTS idx_service_orders_ad_lead ON service_orders (ad_lead_id)
  WHERE ad_lead_id IS NOT NULL;
