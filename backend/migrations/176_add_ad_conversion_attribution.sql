-- 176 — Conversion attribution (P0). Link a paid service_order back to the ad lead it came
-- from, so the performance roll-up actually records bookings/revenue/ROI (today
-- service_orders.ad_lead_id — added in migration 147 — is never written, so the roll-up's
-- JOIN matches nothing and ROI/True-Margin are structurally 0). Adds audit columns + the
-- indexes the contact-match query needs. See ads-conversion-attribution-scope.md.

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS ad_attribution_method TEXT,   -- 'deterministic' | 'contact_match'
  ADD COLUMN IF NOT EXISTS ad_attributed_at TIMESTAMPTZ;

-- Email match (case-insensitive) + the roll-up/idempotency lookups by ad_lead_id.
CREATE INDEX IF NOT EXISTS idx_ad_leads_lower_email ON ad_leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_service_orders_ad_lead ON service_orders (ad_lead_id);
