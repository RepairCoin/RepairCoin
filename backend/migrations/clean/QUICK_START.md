# Database Migration Quick Start Guide

This guide will help you quickly set up or update your RepairCoin database.

## Prerequisites

- PostgreSQL 15+ installed
- Database created
- Connection details ready

## Option 1: Quick Setup (Recommended)

### Step 1: Set Database URL

```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/repaircoin_prod"
```

Or use your existing `.env` file:
```bash
export DATABASE_URL=$(grep DATABASE_URL ../../.env | cut -d '=' -f2)
```

### Step 2: Run Migrations

**For a FRESH database (new installation):**
```bash
cd backend/migrations/clean
./run-migrations.sh fresh
```

**For an EXISTING database (update):**
```bash
cd backend/migrations/clean
./run-migrations.sh update
```

That's it! ✅

---

## Option 2: Manual Setup

### Fresh Database

Run migrations in order:

```bash
# Set your database URL
DB="postgresql://username:password@localhost:5432/repaircoin_prod"

# Run each migration
psql $DB -f backend/migrations/clean/001_initial_schema.sql
psql $DB -f backend/migrations/clean/002_add_webhook_logs_and_archiving.sql
psql $DB -f backend/migrations/clean/003_add_stripe_and_purchase_improvements.sql
psql $DB -f backend/migrations/clean/004_remove_obsolete_columns.sql
psql $DB -f backend/migrations/clean/005_add_social_media_fields.sql
```

### Existing Database

Skip migration 001 (you already have the base schema):

```bash
# Set your database URL
DB="postgresql://username:password@localhost:5432/repaircoin_prod"

# Run only new migrations
psql $DB -f backend/migrations/clean/002_add_webhook_logs_and_archiving.sql
psql $DB -f backend/migrations/clean/003_add_stripe_and_purchase_improvements.sql
psql $DB -f backend/migrations/clean/004_remove_obsolete_columns.sql
psql $DB -f backend/migrations/clean/005_add_social_media_fields.sql
```

---

## Option 3: Using npm Scripts

Add to your `backend/package.json`:

```json
{
  "scripts": {
    "migrate:fresh": "cd migrations/clean && ./run-migrations.sh fresh",
    "migrate:update": "cd migrations/clean && ./run-migrations.sh update"
  }
}
```

Then run:
```bash
npm run migrate:update
```

---

## Verification

After running migrations, verify everything is set up:

### 1. Check Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- ✅ `webhook_logs` (new)
- ✅ `system_settings` (new)
- ✅ `archived_transactions` (new)
- ✅ `platform_statistics` (new materialized view)
- ✅ All your existing tables

### 2. Check Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

You should see:
- ✅ `cleanup_old_webhook_logs`
- ✅ `archive_old_transactions`
- ✅ `get_webhook_health`
- ✅ `refresh_platform_statistics`

### 3. Test Platform Statistics
```sql
SELECT * FROM platform_statistics;
```

Should return comprehensive platform metrics.

### 4. Test Webhook Health Function
```sql
SELECT * FROM get_webhook_health();
```

Should return health metrics (may be empty if no webhooks processed yet).

### 5. Check System Settings
```sql
SELECT * FROM system_settings;
```

Should show default configuration values.

---

## What Gets Created

### Migration 001 (Base Schema)
- All core tables (customers, shops, transactions, etc.)
- Sequences and indexes
- Basic constraints

### Migration 002 (Webhook & Archiving Infrastructure) ⭐ NEW
- `webhook_logs` - Track all incoming webhooks
- `system_settings` - Persistent configuration
- `archived_transactions` - Long-term storage
- `platform_statistics` - Cached metrics view
- Maintenance functions for cleanup and health checks

### Migration 003 (Stripe Improvements)
- Stripe customer email and name fields
- Purchase completion tracking

### Migration 004 (Column Cleanup)
- Removes obsolete `cross_shop_enabled` column
- Removes obsolete earning limit columns

### Migration 005 (Social Media)
- Facebook, Twitter, Instagram URL fields for shops

---

## Post-Migration

### Start Your Backend
```bash
cd backend
npm run dev
```

The following will start automatically:
- ✅ **Cleanup Service** - Daily archiving and cleanup
- ✅ **Statistics Refresh** - Every 5 minutes
- ✅ **Webhook Logging** - Automatic on all webhook requests

### Monitor Services

**Webhook Health:**
```bash
curl http://localhost:4000/api/webhooks/health
```

**Webhook Logs:**
```bash
curl http://localhost:4000/api/webhooks/logs?page=1&limit=10
```

**Platform Statistics:**
Call `adminRepository.getPlatformStatisticsFromView()` in your code.

---

## Troubleshooting

### Error: "DATABASE_URL not set"
Make sure you exported the DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

### Error: "relation already exists"
You're running `fresh` mode on an existing database. Use `update` mode instead:
```bash
./run-migrations.sh update
```

### Error: "permission denied"
Make the script executable:
```bash
chmod +x run-migrations.sh
```

### Error: "psql: command not found"
Install PostgreSQL client tools:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Install from https://www.postgresql.org/download/windows/
```

---

## Configuration

After migration, you can customize settings in the `system_settings` table:

```sql
-- Change webhook retention to 60 days
UPDATE system_settings
SET value = '60'
WHERE key = 'webhook_retention_days';

-- Change transaction archiving to 180 days
UPDATE system_settings
SET value = '180'
WHERE key = 'transaction_archive_days';

-- Change statistics refresh interval to 10 minutes
UPDATE system_settings
SET value = '600'
WHERE key = 'statistics_refresh_interval';
```

After changing settings, restart your backend server to apply changes.

---

## Need Help?

- 📖 See `README.md` for detailed documentation
- 🐛 Check migration files for rollback instructions (in comments)
- 💬 Contact the development team

---

## Quick Reference

```bash
# Fresh database
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
cd backend/migrations/clean
./run-migrations.sh fresh

# Existing database
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
cd backend/migrations/clean
./run-migrations.sh update

# Verify
psql $DATABASE_URL -c "SELECT * FROM platform_statistics;"
```

Done! 🎉
