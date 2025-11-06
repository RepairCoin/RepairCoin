-- Migration: Rename Shop Groups to Affiliate Shop Groups
-- Description: Renames existing shop group tables to affiliate shop group tables
-- Date: 2025-11-06

-- Rename tables
ALTER TABLE IF EXISTS shop_groups RENAME TO affiliate_shop_groups;
ALTER TABLE IF EXISTS shop_group_members RENAME TO affiliate_shop_group_members;
ALTER TABLE IF EXISTS customer_group_balances RENAME TO customer_affiliate_group_balances;
ALTER TABLE IF EXISTS group_token_transactions RENAME TO affiliate_group_token_transactions;
ALTER TABLE IF EXISTS shop_group_settings RENAME TO affiliate_shop_group_settings;

-- Rename indexes (shop_groups table)
ALTER INDEX IF EXISTS idx_shop_groups_active RENAME TO idx_affiliate_shop_groups_active;
ALTER INDEX IF EXISTS idx_shop_groups_type RENAME TO idx_affiliate_shop_groups_type;

-- Rename indexes (shop_group_members table)
ALTER INDEX IF EXISTS idx_group_members_shop RENAME TO idx_affiliate_group_members_shop;
ALTER INDEX IF EXISTS idx_group_members_group RENAME TO idx_affiliate_group_members_group;
ALTER INDEX IF EXISTS idx_group_members_status RENAME TO idx_affiliate_group_members_status;

-- Rename indexes (customer_group_balances table)
ALTER INDEX IF EXISTS idx_customer_group_balances_customer RENAME TO idx_customer_affiliate_group_balances_customer;
ALTER INDEX IF EXISTS idx_customer_group_balances_group RENAME TO idx_customer_affiliate_group_balances_group;

-- Rename indexes (group_token_transactions table)
ALTER INDEX IF EXISTS idx_group_transactions_customer RENAME TO idx_affiliate_group_transactions_customer;
ALTER INDEX IF EXISTS idx_group_transactions_group RENAME TO idx_affiliate_group_transactions_group;
ALTER INDEX IF EXISTS idx_group_transactions_shop RENAME TO idx_affiliate_group_transactions_shop;
ALTER INDEX IF EXISTS idx_group_transactions_type RENAME TO idx_affiliate_group_transactions_type;

-- Update comments
COMMENT ON TABLE affiliate_shop_groups IS 'Affiliate shop coalitions with custom loyalty tokens';
COMMENT ON TABLE affiliate_shop_group_members IS 'Membership records for shops in affiliate groups';
COMMENT ON TABLE customer_affiliate_group_balances IS 'Off-chain tracking of customer affiliate group token balances';
COMMENT ON TABLE affiliate_group_token_transactions IS 'Transaction history for affiliate group tokens';
COMMENT ON TABLE affiliate_shop_group_settings IS 'Configurable rules and limits for each affiliate group';
