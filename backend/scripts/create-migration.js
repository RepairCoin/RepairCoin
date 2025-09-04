const fs = require('fs').promises;
const path = require('path');

async function createMigration() {
    const name = process.argv[2];
    if (!name) {
        console.error('❌ Usage: npm run db:create-migration <migration_name>');
        console.error('   Example: npm run db:create-migration add_user_preferences');
        process.exit(1);
    }

    // Validate migration name
    if (!/^[a-z0-9_]+$/.test(name)) {
        console.error('❌ Migration name should only contain lowercase letters, numbers, and underscores');
        process.exit(1);
    }

    const migrationDir = path.join(__dirname, '../migrations');
    
    // Ensure migrations directory exists
    await fs.mkdir(migrationDir, { recursive: true });
    
    const files = await fs.readdir(migrationDir);
    const lastNumber = files
        .filter(f => f.endsWith('.sql'))
        .map(f => parseInt(f.split('_')[0]))
        .filter(n => !isNaN(n))
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
        
        -- ================================================
        -- YOUR MIGRATION SQL HERE
        -- ================================================
        
        -- Example:
        -- CREATE TABLE example_table (
        --     id SERIAL PRIMARY KEY,
        --     name VARCHAR(255) NOT NULL,
        --     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        -- );
        
        -- CREATE INDEX idx_example_name ON example_table(name);
        
        
        -- ================================================
        -- RECORD MIGRATION
        -- ================================================
        INSERT INTO schema_migrations (version, name) VALUES (${nextNumber}, '${name}');
        
        RAISE NOTICE 'Migration ${nextNumber} (${name}) applied successfully';
        
    ELSE
        RAISE NOTICE 'Migration ${nextNumber} (${name}) already applied';
    END IF;
END $$;

-- ================================================
-- ROLLBACK SCRIPT (Optional - for manual use only)
-- ================================================
-- To rollback this migration, run:
-- BEGIN;
-- -- Your rollback SQL here
-- -- DROP TABLE IF EXISTS example_table;
-- DELETE FROM schema_migrations WHERE version = ${nextNumber};
-- COMMIT;
`;

    try {
        // Check if file already exists
        try {
            await fs.access(filePath);
            console.error(`❌ Migration file already exists: ${fileName}`);
            process.exit(1);
        } catch (err) {
            // File doesn't exist, which is what we want
        }

        await fs.writeFile(filePath, template);
        console.log(`✅ Created migration: ${fileName}`);
        console.log(`📝 Edit the file at: ${filePath}`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Edit the migration file with your SQL`);
        console.log(`   2. Run: npm run db:migrate`);
        console.log(`   3. Commit the migration file to git`);
    } catch (error) {
        console.error('❌ Error creating migration:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createMigration();
}

module.exports = createMigration;