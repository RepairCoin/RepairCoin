# RepairCoin Database Schema Documentation

Last Updated: September 4, 2025

## Overview
This document describes the complete database schema for RepairCoin v3.0 with the dual-token model (RCN utility + RCG governance).

## Tables

### 1. customers
Stores customer information and tier status.
```sql
- address (VARCHAR(42), PRIMARY KEY) - Ethereum wallet address
- name (VARCHAR(255)) - Customer name
- email (VARCHAR(255)) - Email address
- phone (VARCHAR(20)) - Phone number
- tier (tier_level) - BRONZE, SILVER, or GOLD
- lifetime_earnings (DECIMAL) - Total RCN earned lifetime
- referral_code (VARCHAR(20), UNIQUE) - Unique referral code
- referral_count (INTEGER) - Number of successful referrals
- daily_earnings (DECIMAL) - RCN earned today
- monthly_earnings (DECIMAL) - RCN earned this month
- last_earned_date (DATE) - Last date RCN was earned
- is_active (BOOLEAN) - Account active status
- is_suspended (BOOLEAN) - Suspension status
- suspension_reason (TEXT) - Reason if suspended
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 2. shops
Stores repair shop information and verification status.
```sql
- shop_id (VARCHAR(50), PRIMARY KEY) - Unique shop identifier
- company_name (VARCHAR(255)) - Business name
- owner_name (VARCHAR(255)) - Owner full name
- wallet_address (VARCHAR(42), UNIQUE) - Shop wallet address
- reimbursement_address (VARCHAR(42)) - Address for RCN reimbursements
- email (VARCHAR(255)) - Contact email
- phone (VARCHAR(20)) - Contact phone
- website (VARCHAR(255)) - Website URL
- role (VARCHAR(50)) - Contact person role
- company_size (VARCHAR(20)) - Employee count range
- monthly_revenue (VARCHAR(50)) - Revenue range
- referral_by (VARCHAR(255)) - Referral source
- street_address (VARCHAR(255)) - Physical address
- city (VARCHAR(100)) - City
- country (VARCHAR(100)) - Country
- is_verified (BOOLEAN) - Verification status
- is_active (BOOLEAN) - Active status
- is_cross_shop_enabled (BOOLEAN) - Cross-shop redemption enabled
- purchased_rcn_balance (DECIMAL) - RCN purchased from RepairCoin
- total_issued_rewards (DECIMAL) - Total RCN issued to customers
- metadata (JSONB) - Additional data
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 3. transactions
Records all RCN token transactions.
```sql
- id (SERIAL PRIMARY KEY)
- transaction_hash (VARCHAR(66), UNIQUE) - Blockchain tx hash
- type (transaction_type) - repair_reward, referral_reward, tier_bonus, redemption, etc.
- amount (DECIMAL) - RCN amount
- customer_address (VARCHAR(42)) - Customer wallet
- shop_id (VARCHAR(50)) - Associated shop
- status (transaction_status) - pending, completed, failed
- metadata (JSONB) - Additional transaction data
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### 4. referrals
Tracks referral relationships and rewards.
```sql
- id (SERIAL PRIMARY KEY)
- referrer_address (VARCHAR(42)) - Referrer wallet
- referred_address (VARCHAR(42)) - New customer wallet
- referral_code (VARCHAR(20)) - Code used
- status (referral_status) - pending, completed, expired
- referrer_reward_amount (DECIMAL) - 25 RCN
- referred_reward_amount (DECIMAL) - 10 RCN
- referrer_reward_tx (VARCHAR(66)) - Reward tx hash
- referred_reward_tx (VARCHAR(66)) - Bonus tx hash
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### 5. customer_rcn_sources
Tracks where customers earned their RCN (for verification).
```sql
- id (SERIAL PRIMARY KEY)
- customer_address (VARCHAR(42))
- source_type (VARCHAR(50)) - repair, referral, tier_bonus, admin_mint
- shop_id (VARCHAR(50)) - Shop where earned
- amount (DECIMAL) - Amount earned
- transaction_id (INTEGER) - Reference to transactions table
- created_at (TIMESTAMP)
```

### 6. shop_rcn_purchases
Records shops purchasing RCN from RepairCoin admin.
```sql
- id (SERIAL PRIMARY KEY)
- shop_id (VARCHAR(50))
- amount (DECIMAL) - RCN amount purchased
- total_cost (DECIMAL) - USD paid ($0.10 per RCN)
- payment_method (VARCHAR(50)) - bank_transfer, crypto, etc.
- payment_reference (VARCHAR(255)) - Payment reference ID
- processed_by (VARCHAR(42)) - Admin who processed
- status (VARCHAR(50)) - pending, completed, refunded
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### 7. redemption_sessions
Manages customer-approved redemption sessions.
```sql
- id (SERIAL PRIMARY KEY)
- session_id (VARCHAR(100), UNIQUE) - UUID session identifier
- customer_address (VARCHAR(42))
- shop_id (VARCHAR(50))
- amount (DECIMAL) - RCN to redeem
- status (session_status) - pending, approved, rejected, expired, completed
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- approved_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### 8. admins (NEW)
Manages admin users with permissions.
```sql
- id (SERIAL PRIMARY KEY)
- wallet_address (VARCHAR(42), UNIQUE) - Admin wallet
- name (VARCHAR(255)) - Admin name
- email (VARCHAR(255)) - Admin email
- permissions (JSONB) - Permission array
- is_active (BOOLEAN) - Active status
- is_super_admin (BOOLEAN) - Super admin flag
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- created_by (VARCHAR(42)) - Who created this admin
- last_login (TIMESTAMP) - Last login time
- metadata (JSONB) - Additional data
```

### 9. tier_bonuses
Tracks tier bonus rewards.
```sql
- id (SERIAL PRIMARY KEY)
- customer_address (VARCHAR(42))
- tier_at_time (tier_level) - Tier when bonus earned
- bonus_amount (DECIMAL) - Bonus RCN amount
- repair_transaction_id (INTEGER) - Related repair transaction
- transaction_hash (VARCHAR(66)) - Blockchain tx hash
- created_at (TIMESTAMP)
```

### 10. cross_shop_verifications
Tracks cross-shop redemption verifications.
```sql
- id (SERIAL PRIMARY KEY)
- customer_address (VARCHAR(42))
- home_shop_id (VARCHAR(50)) - Primary earning shop
- redeeming_shop_id (VARCHAR(50)) - Shop where redeemed
- amount (DECIMAL) - Amount redeemed
- verification_status (VARCHAR(50)) - approved, rejected
- created_at (TIMESTAMP)
```

### 11. webhook_logs
Logs all incoming webhooks for debugging.
```sql
- id (SERIAL PRIMARY KEY)
- event_type (VARCHAR(100)) - repair.completed, etc.
- payload (JSONB) - Full webhook payload
- signature (VARCHAR(255)) - Webhook signature
- processing_status (VARCHAR(50)) - success, failed, invalid
- error_message (TEXT) - Error if failed
- processed_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

### 12. admin_activity_logs
Tracks all admin actions for audit trail.
```sql
- id (SERIAL PRIMARY KEY)
- admin_address (VARCHAR(42)) - Admin who performed action
- action_type (VARCHAR(100)) - Type of action
- action_description (TEXT) - Human-readable description
- entity_type (VARCHAR(50)) - customer, shop, transaction, etc.
- entity_id (VARCHAR(255)) - ID of affected entity
- metadata (JSONB) - Additional context
- created_at (TIMESTAMP)
```

### 13. admin_alerts
System alerts for admin attention.
```sql
- id (SERIAL PRIMARY KEY)
- alert_type (VARCHAR(100)) - Type of alert
- severity (VARCHAR(20)) - low, medium, high, critical
- title (VARCHAR(255)) - Alert title
- message (TEXT) - Alert details
- metadata (JSONB) - Additional data
- acknowledged (BOOLEAN) - Has been seen
- acknowledged_by (VARCHAR(42)) - Admin who acknowledged
- acknowledged_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

### 14. admin_treasury
Tracks RCN token treasury and sales.
```sql
- id (SERIAL PRIMARY KEY)
- total_supply (DECIMAL) - Total RCN supply (1 billion)
- total_sold_to_shops (DECIMAL) - RCN sold to shops
- total_revenue (DECIMAL) - USD revenue from sales
- available_balance (DECIMAL) - RCN available for sale
- last_updated (TIMESTAMP)
- updated_by (VARCHAR(42)) - Admin who updated
```

### 15. schema_migrations (NEW)
Tracks database migrations.
```sql
- version (INTEGER PRIMARY KEY) - Migration version number
- name (VARCHAR(255)) - Migration name
- applied_at (TIMESTAMP) - When migration was applied
```

## Indexes

Key indexes for performance:
- `idx_customers_address` on customers(LOWER(address))
- `idx_customers_tier` on customers(tier)
- `idx_shops_wallet_address` on shops(LOWER(wallet_address))
- `idx_shops_verified` on shops(is_verified, is_active)
- `idx_transactions_customer` on transactions(customer_address, created_at DESC)
- `idx_transactions_shop` on transactions(shop_id, created_at DESC)
- `idx_customer_rcn_sources_customer` on customer_rcn_sources(customer_address)
- `idx_redemption_sessions_customer` on redemption_sessions(customer_address, status)
- `idx_admins_wallet_address` on admins(LOWER(wallet_address))

## Constraints

- Wallet addresses must match pattern: `^0x[a-fA-F0-9]{40}$`
- Tier levels: BRONZE, SILVER, GOLD only
- Transaction types are enum-constrained
- Referral codes must be unique
- Shop IDs must be unique

## Relationships

1. **customers** ← → **transactions** (one-to-many)
2. **shops** ← → **transactions** (one-to-many)
3. **customers** ← → **referrals** (one-to-many as referrer)
4. **customers** ← → **customer_rcn_sources** (one-to-many)
5. **shops** ← → **shop_rcn_purchases** (one-to-many)
6. **customers** ← → **redemption_sessions** (one-to-many)
7. **shops** ← → **redemption_sessions** (one-to-many)
8. **transactions** ← → **tier_bonuses** (one-to-one)

## Notes

- All monetary values are stored as DECIMAL to avoid floating-point issues
- Timestamps are stored WITH TIME ZONE for consistency
- JSONB is used for flexible metadata storage
- Lower-case indexes on addresses for case-insensitive lookups
- The v3.0 update supports unlimited RCN supply with burn mechanism