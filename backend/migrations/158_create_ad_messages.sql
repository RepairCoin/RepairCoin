-- Ads System — lifecycle Phase 2: durable shop↔admin message thread (design decision #4).
--
-- A permanent, two-way, per-SHOP audit trail of the ads relationship (tier changes,
-- campaign requests, billing questions). Distinct from ad_lead_messages (152), which is
-- per-LEAD (customer AI conversations). 'system' rows are auto-posted lifecycle events
-- (subscribe, tier change, request approved/declined, invoice) so the thread is the
-- single record of "what was agreed" — important because money is involved.

CREATE TABLE IF NOT EXISTS ad_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  author      TEXT NOT NULL CHECK (author IN ('shop','admin','system')),
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message','event')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_messages_shop ON ad_messages (shop_id, created_at);
