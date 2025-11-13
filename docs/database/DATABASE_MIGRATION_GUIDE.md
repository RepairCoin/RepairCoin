# Database Migration Guide for RepairCoin

## Overview
This guide establishes best practices for managing database schema changes across the development team to prevent conflicts and ensure consistency.

## Migration Strategy

### 1. Use Numbered Migration Files
All database migrations should be placed in `/backend/migrations/` with a timestamp prefix:

```
backend/migrations/
├── 001_initial_schema.sql
├── 002_add_customers_table.sql
├── 003_add_shops_table.sql
├── 004_add_referrals_system.sql
├── 005_add_tier_bonuses.sql
├── 006_add_redemption_sessions.sql
├── 007_add_treasury_tables.sql
├── 008_add_admins_table.sql          ← We just created this
└── 009_next_feature.sql
```

### 2. Create a Migrations Tracking Table

```sql
-- Run this once in your database
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Migration File Template

Each migration should follow this template:

```sql
-- Migration: 009_feature_name.sql
-- Author: Developer Name
-- Date: YYYY-MM-DD
-- Description: Brief description of what this migration does

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 9) THEN
        
        -- Your migration SQL here
        CREATE TABLE new_feature_table (
            id SERIAL PRIMARY KEY,
            -- ... columns
        );
        
        -- Record migration
        INSERT INTO schema_migrations (version, name) VALUES (9, 'feature_name');
        
    END IF;
END $$;
```

### 4. Create a Migration Runner Script

```bash
#!/bin/bash
# backend/scripts/run-migrations.sh

DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-repaircoin}
DB_NAME=${DB_NAME:-repaircoin}

echo "Running database migrations..."

# Get all migration files in order
for migration in backend/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Applying migration: $migration"
        docker exec -i repaircoin-db psql -U $DB_USER -d $DB_NAME < "$migration"
    fi
done

echo "Migrations complete!"
```

### 5. Add Migration Check Script

```javascript
// backend/scripts/check-migrations.js
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function checkMigrations() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'repaircoin',
        database: process.env.DB_NAME || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123'
    });

    try {
        // Get applied migrations
        const result = await pool.query('SELECT version, name FROM schema_migrations ORDER BY version');
        const applied = new Set(result.rows.map(r => r.version));
        
        // Get migration files
        const migrationDir = path.join(__dirname, '../migrations');
        const files = await fs.readdir(migrationDir);
        const migrations = files
            .filter(f => f.endsWith('.sql'))
            .map(f => ({
                file: f,
                version: parseInt(f.split('_')[0])
            }))
            .sort((a, b) => a.version - b.version);
        
        // Check for unapplied migrations
        const unapplied = migrations.filter(m => !applied.has(m.version));
        
        if (unapplied.length > 0) {
            console.log('⚠️  Unapplied migrations detected:');
            unapplied.forEach(m => console.log(`   - ${m.file}`));
            console.log('\nRun: npm run db:migrate');
            process.exit(1);
        } else {
            console.log('✅ All migrations are up to date');
        }
    } catch (error) {
        console.error('Error checking migrations:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkMigrations();
```

### 6. Update package.json Scripts

Add these scripts to your backend/package.json:

```json
{
  "scripts": {
    "db:migrate": "./scripts/run-migrations.sh",
    "db:check": "node scripts/check-migrations.js",
    "db:create-migration": "node scripts/create-migration.js",
    "predev": "npm run db:check",
    "prestart": "npm run db:migrate"
  }
}
```

### 7. Create Migration Generator

```javascript
// backend/scripts/create-migration.js
const fs = require('fs').promises;
const path = require('path');

async function createMigration() {
    const name = process.argv[2];
    if (!name) {
        console.error('Usage: npm run db:create-migration <migration_name>');
        process.exit(1);
    }

    const migrationDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationDir);
    const lastNumber = files
        .filter(f => f.endsWith('.sql'))
        .map(f => parseInt(f.split('_')[0]))
        .sort((a, b) => b - a)[0] || 0;
    
    const nextNumber = lastNumber + 1;
    const fileName = `${String(nextNumber).padStart(3, '0')}_${name}.sql`;
    const filePath = path.join(migrationDir, fileName);
    
    const template = `-- Migration: ${fileName}
-- Author: ${process.env.USER || 'Unknown'}
-- Date: ${new Date().toISOString().split('T')[0]}
-- Description: ${name.replace(/_/g, ' ')}

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = ${nextNumber}) THEN
        
        -- Your migration SQL here
        
        
        -- Record migration
        INSERT INTO schema_migrations (version, name) VALUES (${nextNumber}, '${name}');
        
    END IF;
END $$;
`;

    await fs.writeFile(filePath, template);
    console.log(`✅ Created migration: ${fileName}`);
}

createMigration().catch(console.error);
```

## Team Workflow

### 1. Before Starting Work
```bash
# Pull latest changes
git pull origin main

# Check for new migrations
npm run db:check

# Apply any new migrations
npm run db:migrate
```

### 2. Creating a New Table/Schema Change
```bash
# Create a new migration file
npm run db:create-migration add_new_feature_table

# Edit the generated file
code backend/migrations/XXX_add_new_feature_table.sql

# Test the migration locally
npm run db:migrate

# Commit both the migration and any related code
git add backend/migrations/XXX_add_new_feature_table.sql
git add backend/src/...
git commit -m "feat: add new feature table and related functionality"
```

### 3. Document Schema Changes

Always update `/DATABASE_SCHEMA.md` with:
- New tables
- Modified columns
- New indexes
- Relationships

### 4. Communication

When adding migrations:
1. Notify the team in Slack/Discord
2. Document any manual steps needed
3. Update the README if deployment process changes

## Handling Conflicts

If two developers create migrations with the same number:
1. The second developer should renumber their migration
2. Update the version in the migration file
3. Re-run migrations locally to test

## Production Deployments

1. Always backup the database before migrations
2. Run migrations in a transaction when possible
3. Have a rollback plan
4. Test migrations on staging first

## Current Database State

As of the latest migration (008), the database includes:
- customers
- shops
- transactions
- referrals
- customer_rcn_sources
- customer_wallets
- shop_rcn_purchases
- tier_bonuses
- token_sources
- cross_shop_verifications
- redemption_sessions
- webhook_logs
- admin_activity_logs
- admin_alerts
- admin_treasury
- unsuspend_requests
- admins (new)

## Quick Commands

```bash
# Check migration status
npm run db:check

# Run all pending migrations
npm run db:migrate

# Create a new migration
npm run db:create-migration migration_name

# Connect to database
docker exec -it repaircoin-db psql -U repaircoin -d repaircoin

# View all tables
docker exec repaircoin-db psql -U repaircoin -d repaircoin -c "\dt"

# View migration history
docker exec repaircoin-db psql -U repaircoin -d repaircoin -c "SELECT * FROM schema_migrations ORDER BY version"
```

## Best Practices

1. **Never modify existing migrations** that have been applied to production
2. **Always create new migrations** for schema changes
3. **Test migrations locally** before committing
4. **Include rollback SQL** in complex migrations
5. **Keep migrations small and focused** on one change
6. **Name migrations descriptively** (e.g., `add_email_to_customers`, not `update_customers`)
7. **Review migration files** in pull requests carefully
8. **Don't use DROP commands** without team discussion

## Emergency Procedures

If a migration fails in production:
1. Don't panic
2. Check the error message
3. If safe, manually fix and record in schema_migrations
4. If not safe, rollback and fix the migration
5. Document the incident

Remember: Database migrations are permanent in production. Think twice, migrate once!