-- 221 — Agency Program, slice 0: schema foundations.
--
-- The Agency Program is an ADD-ON on an existing shop account: a shop activates it (separate
-- $999/mo charge, its own subscription) and its account gains the power to manage up to N
-- independent client shops. Client shops are normal `shops` rows linked to the agency; an
-- agency-linked client is entitled to Growth-tier features without its own subscription.
--
-- The agency is OWNED by the shop that activated the add-on (owner_shop_id). One agency per shop;
-- the owner's own shop is NOT one of its clients.
--
-- This is a generic parent->child hierarchy (agencies -> agency_clients -> shops) intentionally
-- shaped so the deferred Multi-Location feature (one owner, many branches) can reuse the pattern.
--
-- Additive + idempotent. Nothing changes for existing shops until one activates the add-on.

CREATE TABLE IF NOT EXISTS agencies (
  id                    VARCHAR(100) PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL,
  owner_shop_id         VARCHAR(100) NOT NULL,
  contact_email         VARCHAR(255),
  contact_phone         VARCHAR(50),
  stripe_customer_id    VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  client_limit          INTEGER NOT NULL DEFAULT 10,
  per_client_price_cents INTEGER NOT NULL DEFAULT 5000,
  -- Dedicated account manager (mirrors shops.account_manager_address — a bare admin wallet
  -- pointer, no FK; see migration 214).
  account_manager_address VARCHAR(42),
  created_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_agency_status CHECK (status IN ('pending', 'active', 'past_due', 'cancelled'))
);

-- One agency per owning shop.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_owner_shop
  ON agencies (owner_shop_id);

-- Parent->child link: which shops an agency manages. Client shops stay in `shops`.
CREATE TABLE IF NOT EXISTS agency_clients (
  id          VARCHAR(100) PRIMARY KEY,
  agency_id   VARCHAR(100) NOT NULL REFERENCES agencies (id) ON DELETE CASCADE,
  shop_id     VARCHAR(100) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  added_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  removed_at  TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT uq_agency_client UNIQUE (agency_id, shop_id),
  CONSTRAINT chk_agency_client_status CHECK (status IN ('active', 'removed'))
);

CREATE INDEX IF NOT EXISTS idx_agency_clients_agency
  ON agency_clients (agency_id) WHERE status = 'active';

-- Denormalized pointer on shops for fast entitlement resolution ("is this shop agency-managed?").
-- Kept in sync with agency_clients by the application layer.
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS agency_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_shops_agency
  ON shops (agency_id) WHERE agency_id IS NOT NULL;
