-- Migration: Create Shop Groups Tables
-- Description: Adds support for shop coalitions with custom group tokens
-- Date: 2025-11-04

-- Shop groups table
CREATE TABLE IF NOT EXISTS shop_groups (
  group_id VARCHAR(100) PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL,
  description TEXT,
  custom_token_name VARCHAR(100) NOT NULL,
  custom_token_symbol VARCHAR(10) NOT NULL,
  token_value_usd NUMERIC(10,4), -- suggested value per token
  created_by_shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  group_type VARCHAR(20) DEFAULT 'public', -- public or private
  logo_url TEXT,
  invite_code VARCHAR(50) UNIQUE NOT NULL,
  auto_approve_requests BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shop group memberships
CREATE TABLE IF NOT EXISTS shop_group_members (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(100) NOT NULL REFERENCES shop_groups(group_id) ON DELETE CASCADE,
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- admin, member
  status VARCHAR(20) DEFAULT 'pending', -- active, pending, rejected, removed
  joined_at TIMESTAMP,
  request_message TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by_shop_id VARCHAR(100) REFERENCES shops(shop_id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, shop_id)
);

-- Customer group token balances (off-chain tracking)
CREATE TABLE IF NOT EXISTS customer_group_balances (
  id SERIAL PRIMARY KEY,
  customer_address VARCHAR(42) NOT NULL,
  group_id VARCHAR(100) NOT NULL REFERENCES shop_groups(group_id) ON DELETE CASCADE,
  balance NUMERIC(20,8) DEFAULT 0,
  lifetime_earned NUMERIC(20,8) DEFAULT 0,
  lifetime_redeemed NUMERIC(20,8) DEFAULT 0,
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_address, group_id)
);

-- Group token transactions
CREATE TABLE IF NOT EXISTS group_token_transactions (
  id VARCHAR(100) PRIMARY KEY,
  group_id VARCHAR(100) NOT NULL REFERENCES shop_groups(group_id) ON DELETE CASCADE,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  type VARCHAR(20) NOT NULL, -- earn, redeem
  amount NUMERIC(20,8) NOT NULL,
  balance_before NUMERIC(20,8),
  balance_after NUMERIC(20,8),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group settings and rules
CREATE TABLE IF NOT EXISTS shop_group_settings (
  group_id VARCHAR(100) PRIMARY KEY REFERENCES shop_groups(group_id) ON DELETE CASCADE,
  daily_earning_limit NUMERIC(20,8),
  minimum_redemption NUMERIC(20,8),
  maximum_redemption NUMERIC(20,8),
  require_minimum_spend BOOLEAN DEFAULT false,
  minimum_spend_amount NUMERIC(10,2),
  settings_json JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_shop ON shop_group_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON shop_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON shop_group_members(status);
CREATE INDEX IF NOT EXISTS idx_customer_group_balances_customer ON customer_group_balances(customer_address);
CREATE INDEX IF NOT EXISTS idx_customer_group_balances_group ON customer_group_balances(group_id);
CREATE INDEX IF NOT EXISTS idx_group_transactions_customer ON group_token_transactions(customer_address);
CREATE INDEX IF NOT EXISTS idx_group_transactions_group ON group_token_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_transactions_shop ON group_token_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_group_transactions_type ON group_token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_shop_groups_active ON shop_groups(active);
CREATE INDEX IF NOT EXISTS idx_shop_groups_type ON shop_groups(group_type);

-- Comments
COMMENT ON TABLE shop_groups IS 'Shop coalitions with custom loyalty tokens';
COMMENT ON TABLE shop_group_members IS 'Membership records for shops in groups';
COMMENT ON TABLE customer_group_balances IS 'Off-chain tracking of customer group token balances';
COMMENT ON TABLE group_token_transactions IS 'Transaction history for group tokens';
COMMENT ON TABLE shop_group_settings IS 'Configurable rules and limits for each group';
