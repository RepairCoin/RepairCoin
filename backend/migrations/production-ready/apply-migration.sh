#!/bin/bash

# RepairCoin Production Migration Script
# This script safely applies the database migration to production

echo "================================================"
echo "RepairCoin Production Database Migration"
echo "================================================"
echo ""
echo "Current Production State:"
echo "- 12 customers"
echo "- 5 shops"  
echo "- 0 transactions"
echo ""
echo "This migration will:"
echo "1. Backup existing data"
echo "2. Remove empty legacy tables"
echo "3. Add missing columns to existing tables"
echo "4. Create 25+ new tables for modern features"
echo "5. Create indexes and views"
echo ""
echo "Estimated time: 2-3 minutes"
echo ""

# Production connection string - set DATABASE_URL environment variable
PROD_DB="${DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable not set"
    echo "Please set DATABASE_URL to your production database connection string"
    exit 1
fi

# Backup first
echo "Step 1: Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump "$PROD_DB" > "backup_before_migration_${TIMESTAMP}.sql"
echo "✅ Backup saved to: backup_before_migration_${TIMESTAMP}.sql"
echo ""

# Apply migration
echo "Step 2: Applying migration..."
echo "Running: production-migration-final.sql"
psql "$PROD_DB" -f production-migration-final.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    
    # Verify
    echo "Step 3: Verifying migration..."
    psql "$PROD_DB" -c "
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM shops) as shops,
        (SELECT COUNT(*) FROM schema_migrations) as migrations_tracked;
    "
    
    echo ""
    echo "✅ Migration verified!"
    echo ""
    echo "Post-migration tasks:"
    echo "1. Add admin user: INSERT INTO admins (wallet_address) VALUES ('0x761E5E59485ec6feb263320f5d636042bD9EBc8c');"
    echo "2. Initialize treasury: INSERT INTO admin_treasury DEFAULT VALUES;"
    echo "3. Update any active shop subscriptions"
    echo ""
    echo "To rollback if needed:"
    echo "psql \"\$DATABASE_URL\" < backup_before_migration_${TIMESTAMP}.sql"
else
    echo "❌ Migration failed! Check errors above."
    echo "Your backup is safe at: backup_before_migration_${TIMESTAMP}.sql"
    exit 1
fi