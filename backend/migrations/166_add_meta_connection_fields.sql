-- 162_add_meta_connection_fields.sql
--
-- Ads System — shop-side "Connect Meta" flow (Stage 4 connect slice). The shop authorizes
-- FixFlow (Facebook Login OAuth) to run ads on ITS OWN Meta ad account; we store the chosen
-- ad account + Page so campaign push / lead retrieval target the right place.
--   * meta_ad_account_id  — the selected act_<id> campaigns are created under.
--   * meta_page_id        — the Page used for lead ads / messaging.
--   * meta_page_token     — that Page's access token (ENCRYPTED app-layer; column TEXT).
--   * meta_business_id    — optional, for partner/business bookkeeping.
--   * meta_user_id        — the Meta user id (from /me), so deauthorize / data-deletion
--                           callbacks (which carry only the user id) map back to the shop.
-- Reuses migration 148's meta_oauth_token/_refresh_token/_expires_at (the user token) and
-- migration 161's ads_account_connected (the §9.6 gate flag, set true once a Page is selected).
-- See docs/tasks/strategy/ads-system/ads-connect-meta-shop-flow-implementation-plan.md.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_id       TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_token    TEXT,
  ADD COLUMN IF NOT EXISTS meta_business_id   TEXT,
  ADD COLUMN IF NOT EXISTS meta_user_id       TEXT;

CREATE INDEX IF NOT EXISTS idx_shops_meta_user ON shops (meta_user_id) WHERE meta_user_id IS NOT NULL;
