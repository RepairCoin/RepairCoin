-- Ads System — lifecycle Phase 5 (§9.6): ad-account connection gate.
--
-- A campaign can't go live until the shop's ad account is connected (so FixFlow can run
-- ads on it). Pre-live-Meta this is an admin-set flag (the admin confirms agency access
-- is in place); when the Meta OAuth (Stage 4) ships, connecting sets meta_oauth_token and
-- can drive this. Because billing starts at first-live (§9.2), an unconnected shop is
-- never billed — the gate and the billing rule reinforce each other.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS ads_account_connected BOOLEAN NOT NULL DEFAULT false;
