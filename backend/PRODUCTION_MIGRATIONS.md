# Production Database Migrations Guide

This document lists all database migrations in the correct order for production deployment.

## Migration System

The RepairCoin backend uses a migration tracking system with the `schema_migrations` table. Each migration is numbered and must be applied in sequence.

## Prerequisites

Before running migrations, ensure:
- PostgreSQL 15+ is installed
- Database is created: `repaircoin`
- User has necessary permissions
- Environment variables are set (DATABASE_URL or individual DB_* vars)

## Current Migration Files (In Order)

The following migrations exist in `backend/migrations/`:

### 1. `004_add_completed_at_to_purchases.sql`
- Adds `completed_at` timestamp to `shop_rcn_purchases` table
- Tracks when purchases are finalized

### 2. `006_remove_obsolete_columns.sql`
- Cleans up deprecated columns from schema
- Removes unused fields

### 3. `016_add_social_media_fields.sql`
- Adds social media links to shops table
- Fields: facebook, twitter, instagram, website

### 4. `017_create_notifications_table.sql`
- Creates `notifications` table for real-time user notifications
- Supports WebSocket notification system

### 5. `018_create_affiliate_shop_groups.sql`
- Creates `affiliate_shop_groups` table
- Creates `affiliate_shop_group_members` table
- Creates `affiliate_shop_group_transactions` table
- Enables shop coalitions with custom tokens/points

### 6. `019_rename_to_affiliate_shop_groups.sql`
- Renames shop_groups to affiliate_shop_groups
- Updates references and constraints

### 7. `020_migrate_promo_codes_schema.sql`
- Updates promo codes schema
- Adds new fields for enhanced promo functionality

### 8. `021_add_max_bonus_to_validation.sql`
- Adds `max_bonus` field to promo code validation
- Caps percentage-based promo bonuses

### 9. `022_emergency_freeze_audit.sql`
- Creates audit tables for emergency freezes
- Tracks security-related account actions

### 10. `023_hotfix_platform_stats.sql`
- Fixes platform statistics calculations
- Updates aggregation queries

### 11. `024_add_shop_subscriptions_fixed_v2.sql`
- Adds/fixes shop subscription tracking
- Stripe subscription integration

### 12. `025_add_stripe_email_column.sql`
- Adds email column for Stripe customer tracking
- Required for subscription management

### 13. `026_add_unique_constraints.sql`
- Adds unique constraints to prevent duplicate data
- Improves data integrity

## Running Migrations

### Using npm script (recommended):
```bash
cd backend
npm run db:migrate
```

This executes `./scripts/run-migrations.sh` which:
- Connects to the database
- Checks which migrations have been applied
- Runs only new migrations in order
- Updates the `schema_migrations` table

### Manual migration:
```bash
# Check migration status
psql $DATABASE_URL -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"

# Apply specific migration
psql $DATABASE_URL -f migrations/004_add_completed_at_to_purchases.sql
```

## Migration Tracking

The system tracks applied migrations in the `schema_migrations` table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables Required

```bash
# Database connection (use one approach)
DATABASE_URL=postgresql://user:password@host:5432/repaircoin

# OR individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repaircoin
DB_USER=repaircoin
DB_PASSWORD=your_password

# Stripe (for subscription migrations)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
```

## Verification

After running migrations, verify everything is correct:

```sql
-- Check all applied migrations
SELECT * FROM schema_migrations ORDER BY version;

-- Verify table structure
\dt

-- Check for missing tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Important Notes

1. **Never skip migrations** - Always run them in order
2. **Backup first** - Always backup production database before migrations
3. **Test locally** - Test migrations in development/staging first
4. **Migration gaps** - Version numbers 001-003, 005, 007-015 were deleted during cleanup
5. **No rollbacks** - These migrations don't include rollback scripts; restore from backup if needed

## Creating New Migrations

```bash
# Use the create-migration script
npm run db:create-migration "description_of_change"

# This creates: migrations/NNN_description_of_change.sql
# where NNN is the next sequential number
```

## Troubleshooting

**"Migration already applied" error:**
- Check `schema_migrations` table
- Migration was already run

**"Permission denied" error:**
- Ensure database user has CREATE, ALTER, DROP permissions
- May need SUPERUSER for certain extensions

**"Table already exists" error:**
- Migration was partially applied
- Check which tables exist, may need manual cleanup
- Restore from backup if unsure

## Support

For issues with migrations:
1. Check migration logs for detailed error messages
2. Verify database connection settings
3. Ensure database user has necessary permissions
4. Review individual migration SQL for requirements
