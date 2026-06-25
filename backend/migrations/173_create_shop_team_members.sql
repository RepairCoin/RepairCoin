-- Shop Team Management — Phase 1 foundation (docs/TEAM_MANAGEMENT_PLAN.md §3, §9).
--
-- Mirrors the existing platform-admin model (admins.role + admins.permissions JSONB)
-- for shop-scoped multi-user access. Phase 1 is purely additive: this table is created
-- and every existing shop is backfilled with one 'owner' member. No auth/login behavior
-- changes here — those land in Phase 2 behind a legacy '*' fallback, so nothing breaks
-- for current single-owner shops (web or mobile) on this migration.

-- 1) The table. Idempotent so re-runs on the shared staging/prod DB are safe.
CREATE TABLE IF NOT EXISTS shop_team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  wallet_address    VARCHAR(42),                 -- NULL until invite accepted; lowercased
  email             VARCHAR(255) NOT NULL,
  name              VARCHAR(255),
  role              VARCHAR(50)  NOT NULL DEFAULT 'staff', -- owner | manager | staff | custom
  permissions       JSONB        NOT NULL DEFAULT '[]'::jsonb, -- ['inventory:manage', ...] or ['*']
  status            VARCHAR(20)  NOT NULL DEFAULT 'invited',   -- invited | active | suspended | removed
  invite_token      VARCHAR(255),                -- one-time accept token (store hashed)
  invite_expires_at TIMESTAMP,
  invited_by        VARCHAR(42),                 -- owner/admin wallet
  invited_at        TIMESTAMP DEFAULT NOW(),
  accepted_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  CONSTRAINT uq_shop_member_wallet UNIQUE (shop_id, wallet_address),
  CONSTRAINT uq_shop_member_email  UNIQUE (shop_id, email),
  CONSTRAINT chk_member_role   CHECK (role IN ('owner','manager','staff','custom')),
  CONSTRAINT chk_member_status CHECK (status IN ('invited','active','suspended','removed'))
);

CREATE INDEX IF NOT EXISTS idx_shop_team_members_shop_id ON shop_team_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_team_members_wallet  ON shop_team_members(wallet_address)
  WHERE wallet_address IS NOT NULL;
-- Email fallback resolution (§5.1 step 3) looks up active members by lowercased email.
CREATE INDEX IF NOT EXISTS idx_shop_team_members_email   ON shop_team_members(LOWER(email))
  WHERE status = 'active';

-- 2) Backfill: one 'owner' member per existing shop. ON CONFLICT keeps this re-runnable
--    and harmless if Phase 1's createShop() owner-seeding has already inserted a row.
INSERT INTO shop_team_members (shop_id, wallet_address, email, name, role, permissions, status, accepted_at)
SELECT
  shop_id,
  LOWER(wallet_address),
  email,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name),
  'owner',
  '["*"]'::jsonb,
  'active',
  NOW()
FROM shops
WHERE wallet_address IS NOT NULL
ON CONFLICT (shop_id, wallet_address) DO NOTHING;
