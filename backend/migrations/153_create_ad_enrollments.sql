-- Ads System — shop-facing "Request ads" opt-in (self-serve enrollment).
--
-- v1 keeps campaign + creative creation admin-only (Q8 — protects the shared Meta
-- account), but shops can now SIGNAL interest and pick a preferred plan. This mirrors
-- the affiliate-groups join-request flow: shop requests → admin approves/declines.
-- On approval the admin's decision sets the shop's ad_billing_plans plan; the admin
-- still builds the actual campaign. One request row per shop.

CREATE TABLE IF NOT EXISTS ad_enrollment_requests (
  shop_id        TEXT PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  requested_plan TEXT NOT NULL DEFAULT 'b' CHECK (requested_plan IN ('a','b','c')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  message        TEXT,
  decided_by     TEXT,
  decided_at     TIMESTAMPTZ,
  decline_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_enrollment_status ON ad_enrollment_requests (status);
