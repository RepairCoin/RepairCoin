# RepairCoin Database Migration Order

## For Production Deployment (Simplified)

### Fresh Database Installation
Run: `complete_production_schema.sql` - This contains everything needed for a fresh installation

### Existing Database Updates
Individual migrations have been archived in `archived_migrations/` directory for reference.
Contact the development team if you need specific migration files.

## Archive Structure

All individual migration files have been moved to `archived_migrations/` including:
- Numbered migrations (000-020)
- Feature-specific migrations (add_*, create_*)
- The old production_migration_v1.sql

The `complete_production_schema.sql` supersedes all of these.

## Production Notes

1. Always backup before running migrations
2. Test in staging environment first
3. The consolidated `production_migration_v1.sql` is preferred for new deployments
4. Monitor application logs after migration
5. Verify all foreign key constraints are satisfied

## Migration Verification

After running migrations, verify:
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check for migration issues
SELECT * FROM migration_tracking ORDER BY applied_at DESC;
```