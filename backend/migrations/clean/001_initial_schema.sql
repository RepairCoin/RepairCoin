-- Complete RepairCoin Database Schema
-- Generated from local database on 2025-09-19T05:12:43.252Z
-- This represents the current state of all tables, indexes, and constraints

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequences
CREATE SEQUENCE IF NOT EXISTS admin_activity_logs_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS admin_alerts_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS admin_treasury_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS admins_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS customer_rcn_sources_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS customer_wallets_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS promo_code_uses_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS promo_codes_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS rcg_staking_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS revenue_distributions_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS shop_subscriptions_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS stripe_customers_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS stripe_payment_attempts_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS stripe_payment_methods_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS stripe_subscription_events_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS stripe_subscriptions_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS subscription_notifications_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS unsuspend_requests_id_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- Tables

-- Table: admin_activity_logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INT4 DEFAULT nextval('admin_activity_logs_id_seq'::regclass) NOT NULL,
  admin_address VARCHAR(42) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_description TEXT,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: admin_alerts
CREATE TABLE IF NOT EXISTS admin_alerts (
  id INT4 DEFAULT nextval('admin_alerts_id_seq'::regclass) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOL DEFAULT false,
  read_at TIMESTAMP,
  read_by VARCHAR(42),
  is_resolved BOOL DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: admin_treasury
CREATE TABLE IF NOT EXISTS admin_treasury (
  id INT4 DEFAULT nextval('admin_treasury_id_seq'::regclass) NOT NULL,
  total_supply NUMERIC(20,8) DEFAULT NULL::numeric,
  available_supply NUMERIC(20,8) DEFAULT NULL::numeric,
  total_sold NUMERIC(20,8) DEFAULT 0,
  total_revenue NUMERIC(20,8) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  supply_model VARCHAR(20) DEFAULT 'unlimited'::character varying,
  circulating_supply NUMERIC(20,8) DEFAULT 0,
  notes TEXT
);

-- Table: admins
CREATE TABLE IF NOT EXISTS admins (
  id INT4 DEFAULT nextval('admins_id_seq'::regclass) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOL DEFAULT true,
  is_super_admin BOOL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(42),
  last_login TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: cross_shop_verifications
CREATE TABLE IF NOT EXISTS cross_shop_verifications (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  redemption_shop_id VARCHAR(100) NOT NULL,
  earning_shop_id VARCHAR(100),
  requested_amount NUMERIC(20,8) NOT NULL,
  available_cross_shop_balance NUMERIC(20,8) NOT NULL,
  verification_result VARCHAR(20) NOT NULL,
  denial_reason TEXT,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: customer_rcn_sources
CREATE TABLE IF NOT EXISTS customer_rcn_sources (
  id INT4 DEFAULT nextval('customer_rcn_sources_id_seq'::regclass) NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_shop_id VARCHAR(50),
  amount NUMERIC(20,8) NOT NULL,
  transaction_id VARCHAR(100),
  transaction_hash VARCHAR(66),
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_redeemable BOOL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: customer_wallets
CREATE TABLE IF NOT EXISTS customer_wallets (
  id INT4 DEFAULT nextval('customer_wallets_id_seq'::regclass) NOT NULL,
  customer_address VARCHAR(42),
  wallet_address VARCHAR(42) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  is_primary BOOL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
  address VARCHAR(42) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  wallet_address VARCHAR(42) NOT NULL,
  is_active BOOL DEFAULT true,
  lifetime_earnings NUMERIC(20,8) DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'BRONZE'::character varying,
  daily_earnings NUMERIC(20,8) DEFAULT 0,
  monthly_earnings NUMERIC(20,8) DEFAULT 0,
  last_earned_date DATE DEFAULT CURRENT_DATE,
  referral_count INT4 DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  suspended_at TIMESTAMP,
  suspension_reason TEXT,
  referral_code VARCHAR(20),
  referred_by VARCHAR(42),
  home_shop_id VARCHAR(50),
  wallet_type VARCHAR(20) DEFAULT 'external'::character varying,
  auth_method VARCHAR(20) DEFAULT 'wallet'::character varying,
  email_verified BOOL DEFAULT false
);

-- Table: promo_code_uses
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id INT4 DEFAULT nextval('promo_code_uses_id_seq'::regclass) NOT NULL,
  promo_code_id INT4 NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  transaction_id VARCHAR(100),
  base_reward NUMERIC(18,2) NOT NULL,
  bonus_amount NUMERIC(18,2) NOT NULL,
  total_reward NUMERIC(18,2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: promo_codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id INT4 DEFAULT nextval('promo_codes_id_seq'::regclass) NOT NULL,
  code VARCHAR(20) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  bonus_type VARCHAR(20) NOT NULL,
  bonus_value NUMERIC(10,2) NOT NULL,
  max_bonus NUMERIC(10,2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  total_usage_limit INT4,
  per_customer_limit INT4 DEFAULT 1,
  times_used INT4 DEFAULT 0,
  total_bonus_issued NUMERIC(18,2) DEFAULT 0,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: rcg_staking
CREATE TABLE IF NOT EXISTS rcg_staking (
  id INT4 DEFAULT nextval('rcg_staking_id_seq'::regclass) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  staked_amount NUMERIC(18,2) NOT NULL,
  staked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  unlock_date TIMESTAMP NOT NULL,
  unstake_requested_at TIMESTAMP,
  rewards_claimed NUMERIC(18,2) DEFAULT 0,
  last_claim_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: redemption_sessions
CREATE TABLE IF NOT EXISTS redemption_sessions (
  session_id VARCHAR(255) NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  max_amount NUMERIC(20,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'::character varying NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  qr_code TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: referrals
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(100) DEFAULT (gen_random_uuid())::text NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  referrer_address VARCHAR(42) NOT NULL,
  referee_address VARCHAR(42),
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval),
  reward_transaction_id VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: revenue_distributions
CREATE TABLE IF NOT EXISTS revenue_distributions (
  id INT4 DEFAULT nextval('revenue_distributions_id_seq'::regclass) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_rcn_sold NUMERIC(18,2) DEFAULT 0 NOT NULL,
  total_revenue_usd NUMERIC(18,2) DEFAULT 0 NOT NULL,
  operations_share NUMERIC(18,2) DEFAULT 0 NOT NULL,
  stakers_share NUMERIC(18,2) DEFAULT 0 NOT NULL,
  dao_treasury_share NUMERIC(18,2) DEFAULT 0 NOT NULL,
  distributed BOOL DEFAULT false,
  distributed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT4 NOT NULL,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- Table: shop_rcn_purchases
CREATE TABLE IF NOT EXISTS shop_rcn_purchases (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  price_per_rcn NUMERIC(10,4) DEFAULT 1.0000,
  total_cost NUMERIC(20,8) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  shop_tier VARCHAR(20) DEFAULT 'standard'::character varying,
  unit_price NUMERIC(10,2) DEFAULT 0.10,
  operations_share NUMERIC(18,2),
  stakers_share NUMERIC(18,2),
  dao_treasury_share NUMERIC(18,2)
);

-- Table: shop_subscriptions
CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id INT4 DEFAULT nextval('shop_subscriptions_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  monthly_amount NUMERIC(10,2) DEFAULT 500.00 NOT NULL,
  subscription_type VARCHAR(20) DEFAULT 'standard'::character varying NOT NULL,
  billing_method VARCHAR(20),
  billing_reference VARCHAR(255),
  payments_made INT4 DEFAULT 0 NOT NULL,
  total_paid NUMERIC(10,2) DEFAULT 0 NOT NULL,
  next_payment_date TIMESTAMP,
  last_payment_date TIMESTAMP,
  is_active BOOL DEFAULT true NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  activated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  cancellation_reason TEXT,
  pause_reason TEXT,
  notes TEXT,
  created_by VARCHAR(42)
);

-- Table: shops
CREATE TABLE IF NOT EXISTS shops (
  shop_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  wallet_address VARCHAR(42) NOT NULL,
  reimbursement_address VARCHAR(42),
  verified BOOL DEFAULT false,
  active BOOL DEFAULT true,
  cross_shop_enabled BOOL DEFAULT false,
  total_tokens_issued NUMERIC(20,8) DEFAULT 0,
  total_redemptions NUMERIC(20,8) DEFAULT 0,
  total_reimbursements NUMERIC(20,8) DEFAULT 0,
  join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fixflow_shop_id VARCHAR(100),
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  location_city VARCHAR(100),
  location_state VARCHAR(100),
  location_zip_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  purchased_rcn_balance NUMERIC(20,8) DEFAULT 0,
  total_rcn_purchased NUMERIC(20,8) DEFAULT 0,
  last_purchase_date TIMESTAMP,
  minimum_balance_alert NUMERIC(20,8) DEFAULT 50,
  auto_purchase_enabled BOOL DEFAULT false,
  auto_purchase_amount NUMERIC(20,8) DEFAULT 100,
  suspended_at TIMESTAMP,
  suspension_reason TEXT,
  verified_at TIMESTAMP,
  verified_by VARCHAR(42),
  rcg_tier VARCHAR(20) DEFAULT 'none'::character varying,
  rcg_balance NUMERIC(18,2) DEFAULT 0,
  rcg_staked_at TIMESTAMP,
  tier_updated_at TIMESTAMP,
  operational_status VARCHAR(50) DEFAULT 'pending'::character varying,
  subscription_active BOOL DEFAULT false,
  subscription_id INT4
);

-- Table: stripe_customers
CREATE TABLE IF NOT EXISTS stripe_customers (
  id INT4 DEFAULT nextval('stripe_customers_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: stripe_payment_attempts
CREATE TABLE IF NOT EXISTS stripe_payment_attempts (
  id INT4 DEFAULT nextval('stripe_payment_attempts_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  attempt_number INT4 DEFAULT 1 NOT NULL,
  status VARCHAR(50) NOT NULL,
  failure_code VARCHAR(100),
  failure_message TEXT,
  amount_cents INT4 NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD'::character varying,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_retry_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: stripe_payment_methods
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
  id INT4 DEFAULT nextval('stripe_payment_methods_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'card'::character varying NOT NULL,
  is_default BOOL DEFAULT false,
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INT4,
  card_exp_year INT4,
  billing_address JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: stripe_subscription_events
CREATE TABLE IF NOT EXISTS stripe_subscription_events (
  id INT4 DEFAULT nextval('stripe_subscription_events_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  stripe_event_id VARCHAR(255),
  data JSONB NOT NULL,
  processed BOOL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: stripe_subscriptions
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id INT4 DEFAULT nextval('stripe_subscriptions_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active'::character varying NOT NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOL DEFAULT false,
  canceled_at TIMESTAMP,
  ended_at TIMESTAMP,
  trial_end TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: subscription_notifications
CREATE TABLE IF NOT EXISTS subscription_notifications (
  id INT4 DEFAULT nextval('subscription_notifications_id_seq'::regclass) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending'::character varying,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: tier_bonuses
CREATE TABLE IF NOT EXISTS tier_bonuses (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  base_transaction_id VARCHAR(100) NOT NULL,
  customer_tier VARCHAR(20) NOT NULL,
  bonus_amount NUMERIC(20,8) NOT NULL,
  base_repair_amount NUMERIC(20,8) NOT NULL,
  base_rcn_earned NUMERIC(20,8) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: token_sources
CREATE TABLE IF NOT EXISTS token_sources (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  source VARCHAR(20) NOT NULL,
  earning_transaction_id VARCHAR(100),
  shop_id VARCHAR(100),
  earned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_redeemable_at_shops BOOL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  reason TEXT,
  transaction_hash VARCHAR(66) NOT NULL,
  block_number INT8,
  timestamp TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  token_source VARCHAR(20) DEFAULT 'earned'::character varying,
  is_cross_shop BOOL DEFAULT false,
  redemption_shop_id VARCHAR(100),
  tier_bonus_amount NUMERIC(20,8) DEFAULT 0,
  base_amount NUMERIC(20,8),
  source_classification VARCHAR(20) DEFAULT 'earned'::character varying
);

-- Table: unsuspend_requests
CREATE TABLE IF NOT EXISTS unsuspend_requests (
  id INT4 DEFAULT nextval('unsuspend_requests_id_seq'::regclass) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  request_reason TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(42),
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: webhook_logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id VARCHAR(100) NOT NULL,
  source VARCHAR(20) NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOL DEFAULT false,
  processing_time INT4,
  result JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP NOT NULL,
  retry_count INT4 DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Constraints

-- Constraints for admin_activity_logs
ALTER TABLE admin_activity_logs ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);

-- Constraints for admin_alerts
ALTER TABLE admin_alerts ADD CONSTRAINT admin_alerts_pkey PRIMARY KEY (id);

-- Constraints for admin_treasury
ALTER TABLE admin_treasury ADD CONSTRAINT admin_treasury_pkey PRIMARY KEY (id);

-- Constraints for admins
ALTER TABLE admins ADD CONSTRAINT admins_pkey PRIMARY KEY (id);
ALTER TABLE admins ADD CONSTRAINT admins_wallet_address_key UNIQUE (wallet_address);

-- Constraints for cross_shop_verifications
ALTER TABLE cross_shop_verifications ADD CONSTRAINT cross_shop_verifications_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE;
ALTER TABLE cross_shop_verifications ADD CONSTRAINT cross_shop_verifications_earning_shop_id_fkey FOREIGN KEY (earning_shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE cross_shop_verifications ADD CONSTRAINT cross_shop_verifications_redemption_shop_id_fkey FOREIGN KEY (redemption_shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE cross_shop_verifications ADD CONSTRAINT cross_shop_verifications_pkey PRIMARY KEY (id);

-- Constraints for customer_rcn_sources
ALTER TABLE customer_rcn_sources ADD CONSTRAINT customer_rcn_sources_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address);
ALTER TABLE customer_rcn_sources ADD CONSTRAINT customer_rcn_sources_source_shop_id_fkey FOREIGN KEY (source_shop_id) REFERENCES shops(shop_id);
ALTER TABLE customer_rcn_sources ADD CONSTRAINT customer_rcn_sources_pkey PRIMARY KEY (id);

-- Constraints for customer_wallets
ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE;
ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_pkey PRIMARY KEY (id);
ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_address_wallet_address_key UNIQUE (customer_address,wallet_address);

-- Constraints for customers
ALTER TABLE customers ADD CONSTRAINT customers_home_shop_id_fkey FOREIGN KEY (home_shop_id) REFERENCES shops(shop_id);
ALTER TABLE customers ADD CONSTRAINT customers_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES customers(address);
ALTER TABLE customers ADD CONSTRAINT customers_pkey PRIMARY KEY (address);
ALTER TABLE customers ADD CONSTRAINT customers_referral_code_key UNIQUE (referral_code);

-- Constraints for promo_code_uses
ALTER TABLE promo_code_uses ADD CONSTRAINT promo_code_uses_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);
ALTER TABLE promo_code_uses ADD CONSTRAINT promo_code_uses_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id);
ALTER TABLE promo_code_uses ADD CONSTRAINT promo_code_uses_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id);
ALTER TABLE promo_code_uses ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);
ALTER TABLE promo_code_uses ADD CONSTRAINT promo_code_uses_promo_code_id_customer_address_transaction__key UNIQUE (promo_code_id,customer_address,transaction_id);

-- Constraints for promo_codes
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id);
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_code_key UNIQUE (code);

-- Constraints for rcg_staking
ALTER TABLE rcg_staking ADD CONSTRAINT rcg_staking_pkey PRIMARY KEY (id);

-- Constraints for redemption_sessions
ALTER TABLE redemption_sessions ADD CONSTRAINT redemption_sessions_pkey PRIMARY KEY (session_id);

-- Constraints for referrals
ALTER TABLE referrals ADD CONSTRAINT referrals_referee_address_fkey FOREIGN KEY (referee_address) REFERENCES customers(address);
ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_address_fkey FOREIGN KEY (referrer_address) REFERENCES customers(address);
ALTER TABLE referrals ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);
ALTER TABLE referrals ADD CONSTRAINT referrals_referral_code_key UNIQUE (referral_code);

-- Constraints for revenue_distributions
ALTER TABLE revenue_distributions ADD CONSTRAINT revenue_distributions_pkey PRIMARY KEY (id);
ALTER TABLE revenue_distributions ADD CONSTRAINT revenue_distributions_week_start_week_end_key UNIQUE (week_start,week_end);

-- Constraints for schema_migrations
ALTER TABLE schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

-- Constraints for shop_rcn_purchases
ALTER TABLE shop_rcn_purchases ADD CONSTRAINT shop_rcn_purchases_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE shop_rcn_purchases ADD CONSTRAINT shop_rcn_purchases_pkey PRIMARY KEY (id);

-- Constraints for shop_subscriptions
ALTER TABLE shop_subscriptions ADD CONSTRAINT shop_subscriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id);
ALTER TABLE shop_subscriptions ADD CONSTRAINT shop_subscriptions_pkey PRIMARY KEY (id);

-- Constraints for shops
ALTER TABLE shops ADD CONSTRAINT shops_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES shop_subscriptions(id);
ALTER TABLE shops ADD CONSTRAINT shops_pkey PRIMARY KEY (shop_id);

-- Constraints for stripe_customers
ALTER TABLE stripe_customers ADD CONSTRAINT stripe_customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE stripe_customers ADD CONSTRAINT stripe_customers_pkey PRIMARY KEY (id);
ALTER TABLE stripe_customers ADD CONSTRAINT stripe_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);

-- Constraints for stripe_payment_attempts
ALTER TABLE stripe_payment_attempts ADD CONSTRAINT stripe_payment_attempts_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE stripe_payment_attempts ADD CONSTRAINT stripe_payment_attempts_stripe_subscription_id_fkey FOREIGN KEY (stripe_subscription_id) REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE CASCADE;
ALTER TABLE stripe_payment_attempts ADD CONSTRAINT stripe_payment_attempts_pkey PRIMARY KEY (id);

-- Constraints for stripe_payment_methods
ALTER TABLE stripe_payment_methods ADD CONSTRAINT stripe_payment_methods_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE stripe_payment_methods ADD CONSTRAINT stripe_payment_methods_stripe_customer_id_fkey FOREIGN KEY (stripe_customer_id) REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE;
ALTER TABLE stripe_payment_methods ADD CONSTRAINT stripe_payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE stripe_payment_methods ADD CONSTRAINT stripe_payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);

-- Constraints for stripe_subscription_events
ALTER TABLE stripe_subscription_events ADD CONSTRAINT stripe_subscription_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE stripe_subscription_events ADD CONSTRAINT stripe_subscription_events_stripe_subscription_id_fkey FOREIGN KEY (stripe_subscription_id) REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE CASCADE;
ALTER TABLE stripe_subscription_events ADD CONSTRAINT stripe_subscription_events_pkey PRIMARY KEY (id);
ALTER TABLE stripe_subscription_events ADD CONSTRAINT stripe_subscription_events_stripe_event_id_key UNIQUE (stripe_event_id);

-- Constraints for stripe_subscriptions
ALTER TABLE stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_stripe_customer_id_fkey FOREIGN KEY (stripe_customer_id) REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE;
ALTER TABLE stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

-- Constraints for subscription_notifications
ALTER TABLE subscription_notifications ADD CONSTRAINT subscription_notifications_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE subscription_notifications ADD CONSTRAINT subscription_notifications_pkey PRIMARY KEY (id);

-- Constraints for tier_bonuses
ALTER TABLE tier_bonuses ADD CONSTRAINT tier_bonuses_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE;
ALTER TABLE tier_bonuses ADD CONSTRAINT tier_bonuses_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE tier_bonuses ADD CONSTRAINT tier_bonuses_pkey PRIMARY KEY (id);

-- Constraints for token_sources
ALTER TABLE token_sources ADD CONSTRAINT token_sources_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE;
ALTER TABLE token_sources ADD CONSTRAINT token_sources_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE token_sources ADD CONSTRAINT token_sources_pkey PRIMARY KEY (id);

-- Constraints for transactions
ALTER TABLE transactions ADD CONSTRAINT transactions_customer_address_fkey FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_redemption_shop_id_fkey FOREIGN KEY (redemption_shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL;
ALTER TABLE transactions ADD CONSTRAINT transactions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

-- Constraints for unsuspend_requests
ALTER TABLE unsuspend_requests ADD CONSTRAINT unsuspend_requests_pkey PRIMARY KEY (id);

-- Constraints for webhook_logs
ALTER TABLE webhook_logs ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);

-- Indexes
CREATE INDEX idx_admin_activity_logs_action ON public.admin_activity_logs USING btree (action_type);
CREATE INDEX idx_admin_activity_logs_admin ON public.admin_activity_logs USING btree (admin_address);
CREATE INDEX idx_admin_activity_logs_created ON public.admin_activity_logs USING btree (created_at);
CREATE INDEX idx_admin_activity_logs_entity ON public.admin_activity_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_admin_alerts_created ON public.admin_alerts USING btree (created_at);
CREATE INDEX idx_admin_alerts_severity ON public.admin_alerts USING btree (severity);
CREATE INDEX idx_admin_alerts_type ON public.admin_alerts USING btree (alert_type);
CREATE INDEX idx_admin_alerts_unread ON public.admin_alerts USING btree (is_read) WHERE (is_read = false);
CREATE INDEX idx_admin_alerts_unresolved ON public.admin_alerts USING btree (is_resolved) WHERE (is_resolved = false);
CREATE INDEX idx_admins_created_at ON public.admins USING btree (created_at DESC);
CREATE INDEX idx_admins_is_active ON public.admins USING btree (is_active);
CREATE INDEX idx_admins_wallet_address ON public.admins USING btree (lower((wallet_address)::text));
CREATE INDEX idx_cross_shop_verifications_customer ON public.cross_shop_verifications USING btree (customer_address);
CREATE INDEX idx_cross_shop_verifications_result ON public.cross_shop_verifications USING btree (verification_result);
CREATE INDEX idx_cross_shop_verifications_shop ON public.cross_shop_verifications USING btree (redemption_shop_id);
CREATE INDEX idx_customer_source ON public.customer_rcn_sources USING btree (customer_address);
CREATE INDEX idx_earned_at ON public.customer_rcn_sources USING btree (earned_at);
CREATE INDEX idx_redeemable ON public.customer_rcn_sources USING btree (is_redeemable);
CREATE INDEX idx_source_shop ON public.customer_rcn_sources USING btree (source_shop_id);
CREATE INDEX idx_source_type ON public.customer_rcn_sources USING btree (source_type);
CREATE INDEX idx_customer_wallets_address ON public.customer_wallets USING btree (wallet_address);
CREATE INDEX idx_customer_wallets_customer_address ON public.customer_wallets USING btree (customer_address);
CREATE INDEX idx_customers_active ON public.customers USING btree (is_active);
CREATE INDEX idx_customers_earnings ON public.customers USING btree (lifetime_earnings);
CREATE INDEX idx_customers_home_shop ON public.customers USING btree (home_shop_id);
CREATE INDEX idx_customers_referral_code ON public.customers USING btree (referral_code);
CREATE INDEX idx_customers_referred_by ON public.customers USING btree (referred_by);
CREATE INDEX idx_customers_suspended_at ON public.customers USING btree (suspended_at);
CREATE INDEX idx_customers_tier ON public.customers USING btree (tier);
CREATE INDEX idx_promo_code_uses_customer ON public.promo_code_uses USING btree (customer_address);
CREATE INDEX idx_promo_code_uses_promo_code ON public.promo_code_uses USING btree (promo_code_id);
CREATE INDEX idx_promo_codes_active_dates ON public.promo_codes USING btree (is_active, start_date, end_date);
CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);
CREATE INDEX idx_promo_codes_shop_id ON public.promo_codes USING btree (shop_id);
CREATE INDEX idx_rcg_staking_active ON public.rcg_staking USING btree (unstake_requested_at) WHERE (unstake_requested_at IS NULL);
CREATE INDEX idx_rcg_staking_wallet ON public.rcg_staking USING btree (wallet_address);
CREATE INDEX idx_redemption_sessions_active ON public.redemption_sessions USING btree (customer_address, status) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying])::text[]));
CREATE INDEX idx_redemption_sessions_customer ON public.redemption_sessions USING btree (customer_address);
CREATE INDEX idx_redemption_sessions_expires ON public.redemption_sessions USING btree (expires_at);
CREATE INDEX idx_redemption_sessions_shop ON public.redemption_sessions USING btree (shop_id);
CREATE INDEX idx_redemption_sessions_status ON public.redemption_sessions USING btree (status);
CREATE INDEX idx_created_at ON public.referrals USING btree (created_at);
CREATE INDEX idx_referee_address ON public.referrals USING btree (referee_address);
CREATE INDEX idx_referral_code ON public.referrals USING btree (referral_code);
CREATE INDEX idx_referrer_address ON public.referrals USING btree (referrer_address);
CREATE INDEX idx_status ON public.referrals USING btree (status);
CREATE INDEX idx_schema_migrations_applied_at ON public.schema_migrations USING btree (applied_at DESC);
CREATE INDEX idx_shop_purchases_date ON public.shop_rcn_purchases USING btree (created_at);
CREATE INDEX idx_shop_purchases_revenue_date ON public.shop_rcn_purchases USING btree (created_at);
CREATE INDEX idx_shop_purchases_shop ON public.shop_rcn_purchases USING btree (shop_id);
CREATE INDEX idx_shop_purchases_shop_tier ON public.shop_rcn_purchases USING btree (shop_tier);
CREATE INDEX idx_shop_purchases_status ON public.shop_rcn_purchases USING btree (status);
CREATE INDEX idx_shop_subscriptions_active ON public.shop_subscriptions USING btree (is_active);
CREATE INDEX idx_shop_subscriptions_next_payment ON public.shop_subscriptions USING btree (next_payment_date);
CREATE INDEX idx_shop_subscriptions_shop_id ON public.shop_subscriptions USING btree (shop_id);
CREATE INDEX idx_shop_subscriptions_status ON public.shop_subscriptions USING btree (status);
CREATE INDEX idx_shops_active ON public.shops USING btree (active);
CREATE INDEX idx_shops_location ON public.shops USING btree (location_city, location_state);
CREATE INDEX idx_shops_rcg_tier ON public.shops USING btree (rcg_tier) WHERE ((rcg_tier)::text <> 'none'::text);
CREATE INDEX idx_shops_suspended_at ON public.shops USING btree (suspended_at);
CREATE INDEX idx_shops_verified ON public.shops USING btree (verified);
CREATE INDEX idx_stripe_customers_shop_id ON public.stripe_customers USING btree (shop_id);
CREATE INDEX idx_stripe_customers_stripe_id ON public.stripe_customers USING btree (stripe_customer_id);
CREATE INDEX idx_stripe_payment_attempts_next_retry ON public.stripe_payment_attempts USING btree (next_retry_at) WHERE (next_retry_at IS NOT NULL);
CREATE INDEX idx_stripe_payment_attempts_shop_id ON public.stripe_payment_attempts USING btree (shop_id);
CREATE INDEX idx_stripe_payment_attempts_status ON public.stripe_payment_attempts USING btree (status);
CREATE INDEX idx_stripe_payment_attempts_subscription_id ON public.stripe_payment_attempts USING btree (stripe_subscription_id);
CREATE INDEX idx_stripe_payment_methods_customer_id ON public.stripe_payment_methods USING btree (stripe_customer_id);
CREATE INDEX idx_stripe_payment_methods_default ON public.stripe_payment_methods USING btree (is_default) WHERE (is_default = true);
CREATE INDEX idx_stripe_payment_methods_shop_id ON public.stripe_payment_methods USING btree (shop_id);
CREATE INDEX idx_stripe_events_processed ON public.stripe_subscription_events USING btree (processed) WHERE (processed = false);
CREATE INDEX idx_stripe_events_shop_id ON public.stripe_subscription_events USING btree (shop_id);
CREATE INDEX idx_stripe_events_type ON public.stripe_subscription_events USING btree (event_type);
CREATE INDEX idx_stripe_subscriptions_customer_id ON public.stripe_subscriptions USING btree (stripe_customer_id);
CREATE INDEX idx_stripe_subscriptions_period_end ON public.stripe_subscriptions USING btree (current_period_end);
CREATE INDEX idx_stripe_subscriptions_shop_id ON public.stripe_subscriptions USING btree (shop_id);
CREATE INDEX idx_stripe_subscriptions_status ON public.stripe_subscriptions USING btree (status);
CREATE INDEX idx_notifications_shop_id ON public.subscription_notifications USING btree (shop_id);
CREATE INDEX idx_notifications_status ON public.subscription_notifications USING btree (status);
CREATE INDEX idx_notifications_type ON public.subscription_notifications USING btree (type);
CREATE INDEX idx_tier_bonuses_customer ON public.tier_bonuses USING btree (customer_address);
CREATE INDEX idx_tier_bonuses_shop ON public.tier_bonuses USING btree (shop_id);
CREATE INDEX idx_tier_bonuses_tier ON public.tier_bonuses USING btree (customer_tier);
CREATE INDEX idx_token_sources_customer ON public.token_sources USING btree (customer_address);
CREATE INDEX idx_token_sources_redeemable ON public.token_sources USING btree (is_redeemable_at_shops);
CREATE INDEX idx_token_sources_source ON public.token_sources USING btree (source);
CREATE INDEX idx_transactions_customer ON public.transactions USING btree (customer_address);
CREATE INDEX idx_transactions_hash ON public.transactions USING btree (transaction_hash);
CREATE INDEX idx_transactions_shop ON public.transactions USING btree (shop_id);
CREATE INDEX idx_transactions_source_classification ON public.transactions USING btree (source_classification);
CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);
CREATE INDEX idx_transactions_timestamp ON public.transactions USING btree ("timestamp");
CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);
CREATE INDEX idx_unsuspend_requests_entity ON public.unsuspend_requests USING btree (entity_type, entity_id);
CREATE INDEX idx_unsuspend_requests_status ON public.unsuspend_requests USING btree (status);
CREATE INDEX idx_webhooks_event ON public.webhook_logs USING btree (event);
CREATE INDEX idx_webhooks_processed ON public.webhook_logs USING btree (processed);
CREATE INDEX idx_webhooks_source ON public.webhook_logs USING btree (source);
CREATE INDEX idx_webhooks_timestamp ON public.webhook_logs USING btree ("timestamp");

-- Views
CREATE OR REPLACE VIEW active_shop_subscriptions AS
 SELECT s.id,
    s.shop_id,
    s.status,
    s.monthly_amount,
    s.subscription_type,
    s.billing_method,
    s.billing_reference,
    s.payments_made,
    s.total_paid,
    s.next_payment_date,
    s.last_payment_date,
    s.is_active,
    s.enrolled_at,
    s.activated_at,
    s.cancelled_at,
    s.paused_at,
    s.resumed_at,
    s.cancellation_reason,
    s.pause_reason,
    s.notes,
    s.created_by,
    sh.name AS shop_name,
    sh.wallet_address AS shop_wallet,
    sh.email AS shop_email
   FROM (shop_subscriptions s
     JOIN shops sh ON (((s.shop_id)::text = (sh.shop_id)::text)))
  WHERE (((s.status)::text = 'active'::text) AND (s.is_active = true));;

CREATE OR REPLACE VIEW referral_stats AS
 SELECT r.referrer_address,
    c.name AS referrer_name,
    count(DISTINCT r.referee_address) AS total_referrals,
    count(DISTINCT
        CASE
            WHEN ((r.status)::text = 'completed'::text) THEN r.referee_address
            ELSE NULL::character varying
        END) AS successful_referrals,
    sum(
        CASE
            WHEN ((r.status)::text = 'completed'::text) THEN 25
            ELSE 0
        END) AS total_earned_rcn,
    max(r.created_at) AS last_referral_date
   FROM (referrals r
     LEFT JOIN customers c ON (((r.referrer_address)::text = (c.address)::text)))
  GROUP BY r.referrer_address, c.name;;

CREATE OR REPLACE VIEW subscription_payment_status AS
 SELECT s.id,
    s.shop_id,
    sh.name AS shop_name,
    s.monthly_amount,
    s.next_payment_date,
    s.last_payment_date,
    s.payments_made,
    s.total_paid,
        CASE
            WHEN (s.next_payment_date < CURRENT_DATE) THEN 'overdue'::text
            WHEN (s.next_payment_date < (CURRENT_DATE + '7 days'::interval)) THEN 'due_soon'::text
            ELSE 'current'::text
        END AS payment_status,
        CASE
            WHEN (s.next_payment_date < CURRENT_DATE) THEN (EXTRACT(day FROM ((CURRENT_DATE)::timestamp without time zone - s.next_payment_date)))::integer
            ELSE 0
        END AS days_overdue
   FROM (shop_subscriptions s
     JOIN shops sh ON (((s.shop_id)::text = (sh.shop_id)::text)))
  WHERE (((s.status)::text = 'active'::text) AND (s.is_active = true))
  ORDER BY s.next_payment_date;;

CREATE OR REPLACE VIEW system_health AS
 SELECT 'healthy'::text AS status,
    ( SELECT count(*) AS count
           FROM customers) AS total_customers,
    ( SELECT count(*) AS count
           FROM shops) AS total_shops,
    ( SELECT count(*) AS count
           FROM transactions) AS total_transactions,
    ( SELECT count(*) AS count
           FROM webhook_logs) AS total_webhook_logs,
    ( SELECT count(*) AS count
           FROM shop_rcn_purchases) AS total_shop_purchases,
    ( SELECT count(*) AS count
           FROM token_sources) AS total_token_sources,
    ( SELECT count(*) AS count
           FROM cross_shop_verifications) AS total_verifications,
    ( SELECT count(*) AS count
           FROM tier_bonuses) AS total_tier_bonuses,
    CURRENT_TIMESTAMP AS checked_at;;

CREATE OR REPLACE VIEW weekly_revenue_summary AS
 SELECT date_trunc('week'::text, shop_rcn_purchases.created_at) AS week_start,
    (date_trunc('week'::text, shop_rcn_purchases.created_at) + '6 days'::interval) AS week_end,
    count(*) AS total_purchases,
    sum(shop_rcn_purchases.amount) AS total_rcn_sold,
    sum(shop_rcn_purchases.total_cost) AS total_revenue,
    sum(shop_rcn_purchases.operations_share) AS total_operations,
    sum(shop_rcn_purchases.stakers_share) AS total_stakers,
    sum(shop_rcn_purchases.dao_treasury_share) AS total_dao,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'standard'::text) THEN shop_rcn_purchases.amount
            ELSE (0)::numeric
        END) AS standard_rcn_sold,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'premium'::text) THEN shop_rcn_purchases.amount
            ELSE (0)::numeric
        END) AS premium_rcn_sold,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'elite'::text) THEN shop_rcn_purchases.amount
            ELSE (0)::numeric
        END) AS elite_rcn_sold,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'standard'::text) THEN shop_rcn_purchases.total_cost
            ELSE (0)::numeric
        END) AS standard_revenue,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'premium'::text) THEN shop_rcn_purchases.total_cost
            ELSE (0)::numeric
        END) AS premium_revenue,
    sum(
        CASE
            WHEN ((shop_rcn_purchases.shop_tier)::text = 'elite'::text) THEN shop_rcn_purchases.total_cost
            ELSE (0)::numeric
        END) AS elite_revenue
   FROM shop_rcn_purchases
  WHERE ((shop_rcn_purchases.status)::text = 'completed'::text)
  GROUP BY (date_trunc('week'::text, shop_rcn_purchases.created_at));;


-- Functions
CREATE OR REPLACE FUNCTION public.assign_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM customers WHERE referral_code = NEW.referral_code) LOOP
            NEW.referral_code := generate_referral_code();
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_purchase_revenue_distribution()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  operations_pct CONSTANT NUMERIC := 0.80;
  stakers_pct CONSTANT NUMERIC := 0.10;
  dao_pct CONSTANT NUMERIC := 0.10;
BEGIN
  -- Only calculate for completed purchases
  IF NEW.status = 'completed' THEN
    -- Get shop tier
    SELECT rcg_tier INTO NEW.shop_tier 
    FROM shops 
    WHERE shop_id = NEW.shop_id;
    
    -- Set unit price based on tier
    CASE NEW.shop_tier
      WHEN 'elite' THEN NEW.unit_price := 0.06;
      WHEN 'premium' THEN NEW.unit_price := 0.08;
      ELSE NEW.unit_price := 0.10; -- standard or none
    END CASE;
    
    -- Calculate revenue shares
    NEW.operations_share := ROUND(NEW.total_cost * operations_pct, 2);
    NEW.stakers_share := ROUND(NEW.total_cost * stakers_pct, 2);
    NEW.dao_treasury_share := ROUND(NEW.total_cost * dao_pct, 2);
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Set all other payment methods for this customer to not default
        UPDATE stripe_payment_methods 
        SET is_default = FALSE 
        WHERE stripe_customer_id = NEW.stripe_customer_id 
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8 character code
    FOR i IN 1..8 LOOP
        result := result || SUBSTRING(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_shop_operational(p_shop_id character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_shop RECORD;
  v_commitment RECORD;
BEGIN
  -- Get shop details
  SELECT * INTO v_shop FROM shops WHERE shop_id = p_shop_id;
  
  IF NOT FOUND OR NOT v_shop.active OR NOT v_shop.verified THEN
    RETURN FALSE;
  END IF;
  
  -- Check RCG balance (assuming we store it)
  IF v_shop.rcg_balance >= 10000 THEN
    RETURN TRUE;
  END IF;
  
  -- Check active commitment
  SELECT * INTO v_commitment 
  FROM commitment_enrollments 
  WHERE shop_id = p_shop_id AND status = 'active';
  
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_rcn_source()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only track confirmed transactions
    IF NEW.status = 'confirmed' AND NEW.type IN ('mint', 'tier_bonus') THEN
        INSERT INTO customer_rcn_sources (
            customer_address,
            source_type,
            source_shop_id,
            amount,
            transaction_id,
            transaction_hash,
            is_redeemable,
            metadata
        ) VALUES (
            NEW.customer_address,
            CASE 
                WHEN NEW.type = 'mint' AND NEW.reason LIKE '%repair%' THEN 'shop_repair'
                WHEN NEW.type = 'mint' AND NEW.reason LIKE '%referral%' THEN 'referral_bonus'
                WHEN NEW.type = 'tier_bonus' THEN 'tier_bonus'
                ELSE 'other'
            END,
            NEW.shop_id,
            NEW.amount,
            NEW.id,
            NEW.transaction_hash,
            NEW.source_classification != 'market',
            jsonb_build_object('reason', NEW.reason, 'type', NEW.type)
        );
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shop_operational_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only check RCG balance and Stripe subscriptions
  IF NEW.rcg_balance >= 10000 THEN
    NEW.operational_status = 'rcg_qualified';
  -- Check for active Stripe subscription
  ELSIF EXISTS (
    SELECT 1 FROM stripe_subscriptions 
    WHERE shop_id = NEW.shop_id AND status = 'active'
  ) THEN
    NEW.operational_status = 'subscription_qualified'; -- Changed from commitment_qualified
  ELSE
    NEW.operational_status = 'not_qualified';
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shop_operational_status_on_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update shop operational status based on subscription status
    IF NEW.status = 'active' THEN
        -- Active subscription qualifies for operational status
        UPDATE shops 
        SET operational_status = 'subscription_qualified',
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = NEW.shop_id;
        
        RAISE NOTICE 'Shop % set to subscription_qualified due to active subscription', NEW.shop_id;
    
    ELSIF NEW.status IN ('past_due', 'unpaid', 'canceled') THEN
        -- Check if shop has RCG qualification, otherwise set to not_qualified
        UPDATE shops 
        SET operational_status = CASE 
                WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
                ELSE 'not_qualified'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = NEW.shop_id;
        
        RAISE NOTICE 'Shop % subscription status changed to %', NEW.shop_id, NEW.status;
    -- Don't change operational status for incomplete subscriptions
    ELSIF NEW.status = 'incomplete' THEN
        RAISE NOTICE 'Shop % subscription is incomplete, not changing operational status', NEW.shop_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shop_operational_status_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE shops 
  SET commitment_enrolled = CASE 
    WHEN NEW.status = 'active' AND NEW.is_active = true THEN true
    ELSE false
  END,
  operational_status = CASE
    WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'commitment_qualified'
    WHEN (SELECT rcg_balance FROM shops WHERE shop_id = NEW.shop_id) >= 10000 THEN 'rcg_qualified'
    ELSE 'not_qualified'
  END
  WHERE shop_id = NEW.shop_id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shop_tier()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.rcg_balance >= 200000 THEN
    NEW.rcg_tier = 'elite';
  ELSIF NEW.rcg_balance >= 50000 THEN
    NEW.rcg_tier = 'premium';
  ELSIF NEW.rcg_balance >= 10000 THEN
    NEW.rcg_tier = 'standard';
  ELSE
    NEW.rcg_tier = 'none';
  END IF;
  
  NEW.tier_updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v1()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v3(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v3$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v4$function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v5(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v5$function$
;

CREATE OR REPLACE FUNCTION public.uuid_nil()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_nil$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_dns()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_dns$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_oid()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_oid$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_url()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_url$function$
;

CREATE OR REPLACE FUNCTION public.uuid_ns_x500()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_x500$function$
;

CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code character varying, p_shop_id character varying, p_customer_address character varying)
 RETURNS TABLE(is_valid boolean, error_message text, promo_code_id integer, bonus_type character varying, bonus_value numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_promo RECORD;
  v_usage_count INTEGER;
  v_customer_uses INTEGER;
BEGIN
  -- Normalize inputs
  p_code := UPPER(TRIM(p_code));
  p_customer_address := LOWER(TRIM(p_customer_address));
  
  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = p_code
    AND shop_id = p_shop_id
    AND is_active = true;
  
  -- Check if promo code exists
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT 
      false,
      'Invalid promo code',
      NULL::INTEGER,
      NULL::VARCHAR(20),
      NULL::NUMERIC(10, 2);
    RETURN;
  END IF;
  
  -- Check date validity
  IF CURRENT_TIMESTAMP < v_promo.start_date THEN
    RETURN QUERY SELECT 
      false,
      'Promo code not yet active',
      v_promo.id,
      v_promo.bonus_type,
      v_promo.bonus_value;
    RETURN;
  END IF;
  
  IF CURRENT_TIMESTAMP > v_promo.end_date THEN
    RETURN QUERY SELECT 
      false,
      'Promo code has expired',
      v_promo.id,
      v_promo.bonus_type,
      v_promo.bonus_value;
    RETURN;
  END IF;
  
  -- Check total usage limit
  IF v_promo.total_usage_limit IS NOT NULL THEN
    IF v_promo.times_used >= v_promo.total_usage_limit THEN
      RETURN QUERY SELECT 
        false,
        'Promo code usage limit reached',
        v_promo.id,
        v_promo.bonus_type,
        v_promo.bonus_value;
      RETURN;
    END IF;
  END IF;
  
  -- Check per-customer usage limit
  IF v_promo.per_customer_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_uses
    FROM promo_code_uses pcu
    WHERE pcu.promo_code_id = v_promo.id
      AND pcu.customer_address = p_customer_address;
    
    IF v_customer_uses >= v_promo.per_customer_limit THEN
      RETURN QUERY SELECT 
        false,
        'You have already used this promo code',
        v_promo.id,
        v_promo.bonus_type,
        v_promo.bonus_value;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true,
    NULL::TEXT,
    v_promo.id,
    v_promo.bonus_type,
    v_promo.bonus_value;
END;
$function$
;


-- Triggers
-- Trigger: update_admins_updated_at on admins
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: assign_referral_code_trigger on customers
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION assign_referral_code()

-- Trigger: update_customers_updated_at on customers
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: calculate_revenue_on_purchase on shop_rcn_purchases
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION calculate_purchase_revenue_distribution()

-- Trigger: trigger_update_shop_on_subscription_change on shop_subscriptions
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_shop_operational_status_on_subscription()

-- Trigger: update_shop_operational_status_subscription_trigger on shop_subscriptions
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_shop_operational_status_subscription()

-- Trigger: update_operational_status on shops
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_shop_operational_status()

-- Trigger: update_shop_tier_trigger on shops
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_shop_tier()

-- Trigger: update_shops_updated_at on shops
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: update_stripe_customers_updated_at on stripe_customers
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: ensure_single_default_payment_method_trigger on stripe_payment_methods
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION ensure_single_default_payment_method()

-- Trigger: update_stripe_payment_methods_updated_at on stripe_payment_methods
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: update_shop_operational_status_on_subscription_trigger on stripe_subscriptions
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_shop_operational_status_on_subscription()

-- Trigger: update_stripe_subscriptions_updated_at on stripe_subscriptions
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION update_updated_at_column()

-- Trigger: track_rcn_source_trigger on transactions
-- Note: Trigger definitions need to be manually reconstructed
-- Action: EXECUTE FUNCTION track_rcn_source()

