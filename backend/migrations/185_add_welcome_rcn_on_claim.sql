-- 185 — Welcome RCN on claim (Phase 1: config + guard). Grants a one-time RCN reward when an
-- imported/migrated customer claims their account (the conversion incentive for the Square→FixFlow
-- win-back). DECISIONS (see docs/tasks/strategy/customer-migration/welcome-rcn-on-claim-scope.md):
--   A: shop-funded, opt-in  (debit shops.purchased_rcn_balance)
--   B: off-chain credit only (increment customers.current_rcn_balance; no on-chain mint)
--   C: 25 RCN global default + optional per-shop override
-- The whole feature also sits behind the ENABLE_WELCOME_RCN flag (default off). Idempotent.

ALTER TABLE shops
  -- Per-shop opt-in. Default false: no shop grants welcome RCN until it explicitly turns it on.
  ADD COLUMN IF NOT EXISTS welcome_rcn_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Optional per-shop amount override. NULL = use the global default (WELCOME_RCN_DEFAULT_AMOUNT).
  ADD COLUMN IF NOT EXISTS welcome_rcn_amount  NUMERIC(12,2);

ALTER TABLE customers
  -- One-grant-per-customer guard. Set the first time a welcome grant is made; the claim flow
  -- skips the grant when this is non-null. Complements the customer_rcn_sources
  -- sourceType='migration_welcome' provenance row.
  ADD COLUMN IF NOT EXISTS welcome_rcn_granted_at TIMESTAMPTZ;
