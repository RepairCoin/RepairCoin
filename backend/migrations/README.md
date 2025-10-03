# RepairCoin Database Migrations

## Quick Start

For production deployment, use:
```bash
psql -U your_user -d your_database -f complete_production_schema.sql
```

## Directory Structure

- **complete_production_schema.sql** - The complete, consolidated schema for production
- **archived_migrations/** - Individual migration files (kept for reference)
- **generated/** - Auto-generated schema dumps
- **production-analysis/** - Analysis reports from production
- **production-ready/** - Production verification reports

## Important Notes

1. The `complete_production_schema.sql` includes:
   - All base tables and indexes
   - Shop subscriptions system
   - Redemption sessions
   - RCG support
   - ETH payment methods
   - Shop deposits
   - All views and triggers
   - Latest column updates

2. This schema assumes PostgreSQL 15+ with extensions:
   - uuid-ossp
   - pgcrypto

3. Always backup your database before running migrations

4. For incremental updates to existing databases, consult the archived_migrations directory

## Migration History

See `MIGRATION_ORDER.md` for details about the migration consolidation process.