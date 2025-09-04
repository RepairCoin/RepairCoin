# Database Migrations

All database migrations for RepairCoin are stored in this directory. They should be run in numerical order.

## Migration Files

1. **000_complete_schema.sql** - Complete database schema (use for fresh installs)
2. **001_init_database.sql** - Initial database setup (legacy, superseded by 000)
3. **002_unlimited_supply.sql** - Updates for v3.0 unlimited RCN supply ✅ Applied locally
4. **003_add_admin_logs.sql** - Adds admin activity logging
5. **004_add_admin_tables.sql** - Adds admin management tables
6. **005_add_suspension_fields.sql** - Adds customer suspension features
7. **006_fix_referral_case_sensitivity.sql** - Fixes case-sensitive referral codes
8. **007_add_admins_table.sql** - Creates admins table for storing admin users with permissions

## How to Apply Migrations

### Local Database (Docker)
```bash
# Apply a specific migration
docker exec -i repaircoin-db psql -U repaircoin -d repaircoin < 002_unlimited_supply.sql

# Apply all migrations in order
for file in *.sql; do
  docker exec -i repaircoin-db psql -U repaircoin -d repaircoin < "$file"
done
```

### DigitalOcean Database
1. Connect using TablePlus or psql
2. Run the migration SQL files in order
3. Verify changes with `SELECT * FROM admin_treasury;`

## Current Status

- **Local DB**: Migration 002 applied ✅
- **DigitalOcean DB**: Needs migration 002 for unlimited supply

## Important Notes

- Always backup your database before running migrations
- Migrations are designed to be idempotent (safe to run multiple times)
- The 002_unlimited_supply.sql is critical for v3.0 functionality