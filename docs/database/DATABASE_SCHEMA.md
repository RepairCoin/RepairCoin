# RepairCoin Database Schema Documentation

Last Updated: October 2025

## Overview
This document describes the complete database schema for RepairCoin with the dual-token model (RCN utility + RCG governance) and subscription system.

## Core Tables

### 1. customers
Stores customer information and tier status.
```sql
- address (VARCHAR(42), PRIMARY KEY) - Ethereum wallet address
- name (VARCHAR(255)) - Customer name
- email (VARCHAR(255)) - Email address  
- phone (VARCHAR(20)) - Phone number
- tier (tier_level) - BRONZE, SILVER, or GOLD
- lifetime_earnings (DECIMAL(20,2)) - Total RCN earned lifetime
- lifetime_redeemed (DECIMAL(20,2)) - Total RCN redeemed
- referral_code (VARCHAR(20), UNIQUE) - Unique referral code
- referral_count (INTEGER) - Number of successful referrals
- last_earned_date (DATE) - Last date RCN was earned
- is_active (BOOLEAN DEFAULT true) - Account active status
- is_suspended (BOOLEAN DEFAULT false) - Suspension status
- suspension_reason (TEXT) - Reason if suspended
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 2. shops
Stores repair shop information and subscription status.
```sql
- shop_id (VARCHAR(50), PRIMARY KEY) - Unique shop identifier
- name (VARCHAR(255), UNIQUE) - Business name
- owner_name (VARCHAR(255)) - Owner full name
- wallet_address (VARCHAR(42), UNIQUE) - Shop wallet address
- email (VARCHAR(255)) - Contact email
- phone (VARCHAR(20)) - Contact phone
- website (VARCHAR(255)) - Website URL
- rcn_balance (DECIMAL(20,2) DEFAULT 0) - Current RCN balance
- rcg_balance (DECIMAL(20,2) DEFAULT 0) - RCG tokens held
- rcg_tier (VARCHAR(20)) - standard/premium/elite based on RCG
- is_verified (BOOLEAN DEFAULT false) - Verification status
- is_active (BOOLEAN DEFAULT true) - Active status
- is_suspended (BOOLEAN DEFAULT false) - Suspension status
- suspension_reason (TEXT) - Reason if suspended
- operational_status (VARCHAR(50)) - rcg_qualified/commitment_qualified/not_qualified
- subscription_active (BOOLEAN DEFAULT false) - Has active subscription
- subscription_id (INTEGER) - Reference to shop_subscriptions
- eth_payment_address (VARCHAR(42)) - ETH payment address
- accept_eth_payments (BOOLEAN DEFAULT false) - Accept ETH
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 3. transactions
Records all RCN token transactions.
```sql
- id (SERIAL PRIMARY KEY)
- customer_address (VARCHAR(42)) - Customer wallet
- shop_id (VARCHAR(50)) - Shop identifier  
- type (transaction_type) - issue/redeem/transfer
- amount (DECIMAL(20,2)) - Transaction amount
- balance_after (DECIMAL(20,2)) - Customer balance after
- status (VARCHAR(20)) - pending/confirmed/failed
- reference_id (VARCHAR(100)) - External reference
- blockchain_tx_hash (VARCHAR(66)) - Chain transaction hash
- metadata (JSONB) - Additional data
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 4. shop_subscriptions
Monthly subscription management for shops.
```sql
- id (SERIAL PRIMARY KEY)
- shop_id (VARCHAR(255)) - Reference to shops
- status (VARCHAR(20)) - pending/active/cancelled/paused/defaulted
- monthly_amount (DECIMAL(10,2) DEFAULT 500.00) - Monthly fee
- subscription_type (VARCHAR(20) DEFAULT 'standard') - Subscription tier
- billing_method (VARCHAR(20)) - credit_card/ach/wire/crypto
- billing_reference (VARCHAR(255)) - Payment reference
- payments_made (INTEGER DEFAULT 0) - Total payments count
- total_paid (DECIMAL(10,2) DEFAULT 0) - Total amount paid
- next_payment_date (TIMESTAMP) - Next payment due
- last_payment_date (TIMESTAMP) - Last payment received
- is_active (BOOLEAN DEFAULT true) - Currently active
- enrolled_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- activated_at (TIMESTAMP) - Activation date
- cancelled_at (TIMESTAMP) - Cancellation date
- created_by (VARCHAR(42)) - Admin who created
```

### 5. redemption_sessions
QR code-based redemption sessions.
```sql
- session_id (VARCHAR(255), PRIMARY KEY) - Unique session ID
- customer_address (VARCHAR(42)) - Customer wallet
- shop_id (VARCHAR(100)) - Shop identifier
- max_amount (DECIMAL(20,2)) - Maximum redemption amount
- status (VARCHAR(20) DEFAULT 'pending') - pending/approved/used/expired
- created_at (TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
- expires_at (TIMESTAMPTZ) - Session expiration
- approved_at (TIMESTAMPTZ) - Approval timestamp
- used_at (TIMESTAMPTZ) - Usage timestamp
- qr_code (TEXT) - QR code data
- signature (TEXT) - Digital signature
- metadata (JSONB DEFAULT '{}') - Additional data
```

### 6. shop_deposits
Track shop deposits and payments.
```sql
- id (SERIAL PRIMARY KEY)
- shop_id (VARCHAR(255)) - Reference to shops
- deposit_type (VARCHAR(20) DEFAULT 'rcn_purchase') - Type of deposit
- amount (DECIMAL(10,2)) - Deposit amount
- payment_method (VARCHAR(20)) - Payment method used
- reference_number (VARCHAR(255)) - Payment reference
- status (VARCHAR(20) DEFAULT 'pending') - pending/processed/failed
- processed_at (TIMESTAMP) - Processing timestamp
- notes (TEXT) - Admin notes
- metadata (JSONB DEFAULT '{}') - Additional data
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 7. admins
Administrator accounts and permissions.
```sql
- id (SERIAL PRIMARY KEY)
- address (VARCHAR(42), UNIQUE) - Admin wallet address
- name (VARCHAR(255)) - Admin name
- email (VARCHAR(255)) - Admin email
- phone (VARCHAR(50)) - Phone number
- permissions (JSONB DEFAULT '{}') - Permission set
- is_active (BOOLEAN DEFAULT true) - Active status
- is_super_admin (BOOLEAN DEFAULT false) - Super admin flag
- last_login_at (TIMESTAMP) - Last login time
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 8. referrals
Track customer referral relationships.
```sql
- referrer_address (VARCHAR(42)) - Referrer wallet
- referee_address (VARCHAR(42), PRIMARY KEY) - Referee wallet
- referral_date (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- reward_issued (BOOLEAN DEFAULT false) - Reward paid
- reward_date (TIMESTAMP) - When reward was paid
- reward_amount (DECIMAL(20,2)) - RCN reward amount
```

### 9. customer_rcn_sources
Track where customers earned RCN from each shop.
```sql
- id (SERIAL PRIMARY KEY)
- customer_address (VARCHAR(42)) - Customer wallet
- shop_id (VARCHAR(100)) - Shop where earned
- total_earned (DECIMAL(20,2) DEFAULT 0) - Total earned from shop
- total_redeemed (DECIMAL(20,2) DEFAULT 0) - Total redeemed at shop
- last_earned_at (TIMESTAMP) - Last earning date
- last_redeemed_at (TIMESTAMP) - Last redemption date
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

## Stripe Integration Tables

### 10. stripe_customers
Stripe customer records linked to shops.
```sql
- id (SERIAL PRIMARY KEY)
- shop_id (VARCHAR(255)) - Reference to shops
- stripe_customer_id (VARCHAR(255), UNIQUE) - Stripe ID
- email (VARCHAR(255)) - Customer email
- name (VARCHAR(255)) - Customer name
- metadata (JSONB DEFAULT '{}') - Stripe metadata
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 11. stripe_subscriptions
Active Stripe subscriptions.
```sql
- id (SERIAL PRIMARY KEY)
- shop_id (VARCHAR(255)) - Reference to shops
- stripe_subscription_id (VARCHAR(255), UNIQUE) - Stripe ID
- stripe_customer_id (VARCHAR(255)) - Stripe customer
- stripe_price_id (VARCHAR(255)) - Price/plan ID
- status (VARCHAR(50)) - Subscription status
- current_period_start (TIMESTAMP) - Period start
- current_period_end (TIMESTAMP) - Period end
- metadata (JSONB DEFAULT '{}') - Additional data
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

## Supporting Tables

### 12. tier_bonuses
Customer tier progression tracking.
```sql
- customer_address (VARCHAR(42), PRIMARY KEY)
- current_tier (tier_level) - BRONZE/SILVER/GOLD
- total_earned (DECIMAL(20,2)) - Lifetime earnings
- tier_updated_at (TIMESTAMP) - Last tier change
```

### 13. webhook_logs
External webhook event logging.
```sql
- id (UUID PRIMARY KEY)
- source (VARCHAR(50)) - fixflow/stripe/custom
- event_type (VARCHAR(100)) - Event name
- payload (JSONB) - Raw payload
- processed_at (TIMESTAMP) - Processing time
- status (VARCHAR(20)) - success/failed/pending
- error_message (TEXT) - Error details
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### 14. admin_activity_logs
Track admin actions for audit.
```sql
- id (SERIAL PRIMARY KEY)
- admin_id (INTEGER) - Reference to admins
- action (VARCHAR(100)) - Action performed
- entity_type (VARCHAR(50)) - customer/shop/transaction
- entity_id (VARCHAR(255)) - Entity affected
- details (JSONB) - Action details
- ip_address (VARCHAR(45)) - Admin IP
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

## Views

### active_shop_subscriptions
Shows all active shop subscriptions with shop details.
```sql
SELECT s.*, sh.name, sh.wallet_address, sh.email
FROM shop_subscriptions s
JOIN shops sh ON s.shop_id = sh.shop_id
WHERE s.status = 'active' AND s.is_active = true
```

### subscription_payment_status
Track subscription payment status and overdue amounts.
```sql
SELECT subscription details, payment status (overdue/due_soon/current),
days overdue, and shop information
```

## Indexes

Key indexes for performance:
- `idx_transactions_customer` - Fast customer transaction lookup
- `idx_transactions_shop` - Fast shop transaction lookup
- `idx_redemption_sessions_active` - Active session queries
- `idx_shop_subscriptions_status` - Subscription status queries
- `idx_customers_referral_code` - Referral code lookups
- Various foreign key indexes

## Triggers

### update_updated_at_column()
Updates the `updated_at` timestamp on any table modification.

### track_rcn_source()
Automatically tracks RCN earnings by shop in customer_rcn_sources.

### update_shop_operational_status_on_subscription()
Updates shop operational status when subscription changes.

## Business Rules

### Tier System
- **BRONZE**: 0-199 RCN lifetime earnings (no bonus)
- **SILVER**: 200-999 RCN lifetime earnings (+2 RCN per repair)
- **GOLD**: 1000+ RCN lifetime earnings (+5 RCN per repair)

### Earning Rules
- Small repairs ($50-$99): 10 RCN base reward
- Large repairs ($100+): 25 RCN base reward
- No daily or monthly earning limits
- Maximum 25 RCN per single transaction

### Redemption Rules
- **Universal Redemption**: Customers can redeem 100% of their earned RCN at ANY participating shop
- No cross-shop restrictions
- Only earned RCN can be redeemed (market-bought tokens cannot be redeemed)
- 1 RCN = $0.10 USD redemption value

## Enums

### tier_level
- BRONZE (0-199 RCN lifetime earnings)
- SILVER (200-999 RCN lifetime earnings)  
- GOLD (1000+ RCN lifetime earnings)

### transaction_type
- issue (Shop gives RCN to customer)
- redeem (Customer spends RCN at shop)
- transfer (Admin transfers)

## Migration Notes

1. All migrations consolidated in `complete_production_schema.sql`
2. Requires PostgreSQL 15+ with uuid-ossp and pgcrypto extensions
3. Run migrations in a transaction for safety
4. Always backup before migrating production