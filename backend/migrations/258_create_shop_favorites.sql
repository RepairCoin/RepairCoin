-- 258_create_shop_favorites.sql
--
-- Renumbered twice as other branches claimed numbers underneath it: 253/254 were
-- taken first, then 255-257 (shop terminal, POS sales, tax rates). The table itself
-- was already applied to the database under the old 255 number and is unaffected —
-- this file is idempotent, so re-running it is a safe no-op.
--
-- "Follow shop" — lets a customer favorite/follow a shop (distinct from
-- service_favorites, which is per-service). Followers get notified when a
-- followed shop publishes a new service. Mirrors service_favorites.
--
--   follow:   INSERT ... ON CONFLICT DO NOTHING
--   unfollow: DELETE WHERE customer_address = $1 AND shop_id = $2
--   list:     SELECT shop_id FROM shop_favorites WHERE customer_address = $1
--   followers of a shop (for alerts):
--             SELECT customer_address FROM shop_favorites WHERE shop_id = $1

CREATE TABLE IF NOT EXISTS shop_favorites (
  id               BIGSERIAL PRIMARY KEY,
  customer_address VARCHAR(66)  NOT NULL,
  shop_id          VARCHAR(255) NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (customer_address, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_favorites_customer ON shop_favorites (customer_address);
CREATE INDEX IF NOT EXISTS idx_shop_favorites_shop     ON shop_favorites (shop_id);
