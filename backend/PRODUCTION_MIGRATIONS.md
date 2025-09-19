# Production Database Migrations Guide

This document lists all database migrations that need to be applied to production in the correct order.

## Migration System

The RepairCoin backend uses a migration tracking system with the `schema_migrations` table. Each migration has a version number and must be applied in order.

## Base Schema Setup

### 1. Initial Database Setup (`src/database/init.sql`)
- Creates core tables: customers, shops, transactions, webhook_logs
- Creates shop_rcn_purchases, token_sources, cross_shop_verifications
- Creates tier_bonuses, admin_treasury tables
- Sets up indexes and triggers
- Creates system_health view

### 2. Migration Tracking (`migrations/000_create_migration_tracking.sql`)
- Creates `schema_migrations` table to track applied migrations
- Must be run first to enable migration tracking

## Migration Files to Apply (in order)

### 3. Admin Logs (`src/migrations/003_add_admin_logs.sql`)
- Creates `admin_activity_logs` table for audit trail
- Creates `admin_alerts` table for monitoring
- Adds necessary indexes

### 4. Admin Tables (`src/migrations/004_add_admin_tables.sql`)
- Creates comprehensive admin user management system
- Note: Also check `migrations/008_add_admins_table.sql` for additional admin setup

### 5. Suspension Fields (`src/migrations/005_add_suspension_fields.sql`)
- Adds suspension functionality to customers and shops

### 6. Admins Table (`migrations/008_add_admins_table.sql`)
- Creates `admins` table with proper constraints
- Includes migration version tracking

### 7. Promo Codes System (`src/migrations/009_add_promo_codes.sql`)
- Creates `promo_codes` table for promotional campaigns
- Creates `promo_code_uses` tracking table
- Includes validation function

### 8. Stripe Subscription System (`src/migrations/012_stripe_subscriptions.sql`)
- Creates complete Stripe integration tables:
  - `stripe_customers`
  - `stripe_subscriptions`
  - `stripe_payment_methods`
  - `stripe_payment_attempts`
  - `stripe_subscription_events`
  - `subscription_notifications`
- Includes triggers for operational status updates

### 9. Fix Stripe Detection (`src/migrations/014_fix_stripe_subscription_detection.sql`)
- Updates operational status triggers to properly detect Stripe subscriptions
- Fixes existing shops with active subscriptions

### 10. Subscription Model Updates (`migrations/add_shop_subscriptions.sql` and `update_commitment_to_subscription.sql`)
- Converts commitment system to subscription model
- Creates `shop_subscriptions` table (if using non-Stripe path)
- Updates triggers and views

### 11. RCG Token Support (`migrations/add_rcg_support.sql`)
- Adds RCG tier system columns to shops
- Creates `revenue_distributions` table
- Creates `rcg_staking` table for future use
- Adds tier calculation triggers

### 12. Purchase Revenue Tracking (`migrations/add_purchase_revenue_tracking.sql`)
- Enhances shop_rcn_purchases with revenue distribution
- Creates weekly revenue summary view
- Adds automatic revenue calculation triggers

## Migration Commands

### Using npm script:
```bash
npm run db:migrate
```

### Manual migration:
```bash
# Check current migration status
psql -U $DB_USER -d $DB_NAME -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"

# Apply specific migration
psql -U $DB_USER -d $DB_NAME -f migrations/[migration-file].sql
```

### For DigitalOcean or cloud deployment:
Use the `src/migrations/apply_to_digitalocean.sql` which contains cloud-specific adjustments.

## Important Notes

1. **Extension Requirements**: 
   - `uuid-ossp` extension is required but may need superuser privileges
   - `pgcrypto` extension is used in some migrations

2. **Migration Order**: 
   - Always apply migrations in version order
   - Check `schema_migrations` table before applying new ones

3. **Referral System**: 
   - There's a separate `create_referral_system.sql` migration that may need to be applied

4. **Redemption Sessions**: 
   - The `008_create_redemption_sessions.sql` creates customer-shop redemption approval system

5. **Legacy Tables**:
   - `commitment_enrollments` table exists but is being phased out
   - Being replaced by Stripe subscriptions

6. **Environment Variables Required**:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_MONTHLY_PRICE_ID`

## Verification

After applying all migrations, verify by checking:
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check migration status
SELECT * FROM schema_migrations ORDER BY version;

-- Verify operational status triggers work
SELECT routine_name FROM information_schema.routines WHERE routine_type = 'FUNCTION' AND routine_schema = 'public';
```

## Rollback Information

Most migrations include comments for rollback procedures. Always backup the database before applying migrations to production.