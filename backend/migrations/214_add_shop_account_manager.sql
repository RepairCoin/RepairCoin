-- 214 — Account Manager, slice 1: schema only.
--
-- Lets a platform admin be assigned as a shop's dedicated account manager (a Business-tier
-- perk advertised by SupportLevelCard). Track-and-surface only: the shop sees who their AM
-- is; the AM sees the shops assigned to them.
--
-- Additive + idempotent. Nothing changes for any shop until an admin assigns one.
--
-- Wallet-pointer convention: admins have no surrogate FK target in practice (see migration
-- 189's note "no FK references the admins table"), so this mirrors shops.verified_by /
-- admins.created_by — a bare VARCHAR(42) holding the admin's wallet_address, not a real FK.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS account_manager_address VARCHAR(42);

-- Supports the "shops assigned to me" lookup (Slice 4) without scanning every shop.
CREATE INDEX IF NOT EXISTS idx_shops_account_manager
  ON shops (account_manager_address) WHERE account_manager_address IS NOT NULL;
