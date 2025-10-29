# Clean Migration System

This directory contains the properly organized RepairCoin database migrations.

## Migration Files

1. **001_initial_schema.sql** - Complete base schema (all tables, sequences, indexes)
2. **002_add_webhook_logs_and_archiving.sql** - Webhook logging, archiving, system settings
3. **003_add_stripe_and_purchase_improvements.sql** - Stripe customer fields, purchase tracking
4. **004_remove_obsolete_columns.sql** - Remove deprecated columns
5. **005_add_social_media_fields.sql** - Add social media URLs to shops

## Fresh Database Setup

For a completely fresh database:

```bash
# 1. Create database
createdb repaircoin_prod

# 2. Run migrations in order
psql -d repaircoin_prod -f backend/migrations/clean/001_initial_schema.sql
psql -d repaircoin_prod -f backend/migrations/clean/002_add_webhook_logs_and_archiving.sql
psql -d repaircoin_prod -f backend/migrations/clean/003_add_stripe_and_purchase_improvements.sql
psql -d repaircoin_prod -f backend/migrations/clean/004_remove_obsolete_columns.sql
psql -d repaircoin_prod -f backend/migrations/clean/005_add_social_media_fields.sql

# 3. Verify
psql -d repaircoin_prod -c "\dt"
```

## Automated Migration Script

```bash
#!/bin/bash
# Run from project root

DATABASE_URL="postgresql://user:pass@host:5432/dbname"

for migration in backend/migrations/clean/*.sql; do
  echo "Running: $migration"
  psql $DATABASE_URL -f "$migration"
  if [ $? -ne 0 ]; then
    echo "Migration failed: $migration"
    exit 1
  fi
done

echo "All migrations completed successfully!"
```

## For Existing Databases

If you already have data, you only need to run migration 002 (and optionally 003-005):

```bash
# Only apply new tables/features
psql -d your_db -f backend/migrations/clean/002_add_webhook_logs_and_archiving.sql
```

## New Features in Migration 002

### 1. Webhook Logs Table
Tracks all incoming webhooks from Stripe, FixFlow, etc.

### 2. System Settings Table
Persistent configuration storage.

### 3. Archived Transactions Table
Long-term transaction storage.

### 4. Platform Statistics View
Materialized view with aggregated platform metrics.

### 5. Maintenance Functions
- `cleanup_old_webhook_logs(days)` - Remove old webhook logs
- `archive_old_transactions(days)` - Archive old transactions
- `refresh_platform_statistics()` - Refresh stats view
- `get_webhook_health()` - Get webhook health metrics

## Usage Examples

### Refresh Statistics
```sql
SELECT refresh_platform_statistics();
```

### Get Platform Stats
```sql
SELECT * FROM platform_statistics;
```

### Get Webhook Health
```sql
SELECT * FROM get_webhook_health();
```

### Cleanup Old Data
```sql
-- Remove webhook logs older than 90 days
SELECT cleanup_old_webhook_logs(90);

-- Archive transactions older than 365 days
SELECT archive_old_transactions(365);
```

## Cron Job Setup

Add to your cron or use node-cron:

```javascript
// Daily cleanup at 2 AM
cron.schedule('0 2 * * *', async () => {
  await pool.query('SELECT cleanup_old_webhook_logs(90)');
  await pool.query('SELECT archive_old_transactions(365)');
});

// Refresh stats every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await pool.query('SELECT refresh_platform_statistics()');
});
```

## Migration Tracking

All migrations are tracked in the database. To check what's been applied:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

## Rollback

Each migration file includes rollback instructions in comments. Review the specific migration file for rollback commands.

## Old Migrations

The old migrations have been consolidated. They remain in:
- `backend/migrations/*.sql` (old location)
- `backend/migrations/archived_migrations/` (archived)

Do NOT use these for new deployments. Use only the files in `/clean`.
