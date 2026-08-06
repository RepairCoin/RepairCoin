const fs = require('fs').promises;
const path = require('path');

// Query migration numbers already recorded in the database. On a shared dev/staging DB a
// teammate may have applied a number that doesn't yet exist as a file locally — picking
// max(files)+1 would then collide with it (the drift behind the original "164" bug).
// Folding DB versions into the "used" set makes the next number free in BOTH places.
// Best-effort: if the DB is unreachable we fall back to file-only numbering.
/**
 * Every migration number ever committed on ANY ref — local branches, remotes, and history.
 *
 * `git log --all --name-only` over the migrations path catches files that were added and later
 * renamed or deleted, which is what we want: a number that briefly existed on someone's branch may
 * already be recorded on a shared database, and reusing it means silent skipping.
 *
 * Deliberately over-reserves. Treating a number as taken when it might be free costs a gap in the
 * sequence, which nothing depends on. Treating a taken number as free costs a migration that never
 * runs and a bug that surfaces later as a missing relation.
 *
 * Best-effort: returns [] outside a git checkout, or if git is slow enough to hit the timeout. The
 * caller still has files and the DB.
 */
function getVersionsAcrossRefs() {
    try {
        const { execSync } = require('child_process');
        const out = execSync(
            // ':(top)' makes the pathspec repo-root-relative. Without it git resolves it against cwd —
            // backend/scripts — and silently matches nothing, which looks identical to "no other
            // branches have migrations".
            'git log --all --pretty=format: --name-only -- ":(top)*migrations/*.sql"',
            { cwd: __dirname, encoding: 'utf8', timeout: 20000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
        );
        const nums = new Set();
        for (const m of out.matchAll(/migrations\/(\d+)_/g)) nums.add(parseInt(m[1], 10));
        return [...nums].filter((n) => !isNaN(n));
    } catch (_) {
        return [];
    }
}

async function getDbVersions() {
    try { require('dotenv').config(); } catch (_) { /* optional */ }


    let Pool;
    try { ({ Pool } = require('pg')); } catch (_) { return null; }

    const host = process.env.DB_HOST || 'localhost';
    const sslEnabled = process.env.DB_SSL === 'true' || host.includes('digitalocean');
    const config = process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 }
        : {
            host,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'repaircoin',
            user: process.env.DB_USER || 'repaircoin',
            password: process.env.DB_PASSWORD || 'repaircoin123',
            ssl: sslEnabled ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000,
        };

    const pool = new Pool(config);
    try {
        const r = await pool.query('SELECT version FROM schema_migrations');
        return r.rows.map(row => Number(row.version)).filter(n => !isNaN(n));
    } catch (e) {
        console.warn(`⚠️  Could not read schema_migrations (${e.message}). Falling back to file-only numbering.`);
        return null;
    } finally {
        await pool.end().catch(() => {});
    }
}

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
    const usedNumbers = new Set(
        files
            .filter(f => f.endsWith('.sql'))
            .map(f => parseInt(f.split('_')[0]))
            .filter(n => !isNaN(n))
    );

    // Fold in numbers already applied to the database so we never reuse one a teammate
    // has claimed on the shared DB.
    const dbVersions = await getDbVersions();
    if (dbVersions) {
        for (const v of dbVersions) usedNumbers.add(v);
    }

    // ...and numbers claimed by files on OTHER branches, which is the third place a number can be
    // taken and the one nothing used to check. A branch open for a few days will have its local
    // migrations directory left far behind: when this was added, local files stopped at 253 while
    // 254-267 were already claimed elsewhere. Picking max(local)+1 would have collided fourteen times.
    const refVersions = getVersionsAcrossRefs();
    for (const v of refVersions) usedNumbers.add(v);

    console.log(
        `🔢 Numbering against ${usedNumbers.size} known numbers ` +
        `(files${dbVersions ? ' + DB' : ''}${refVersions.length ? ' + all git refs' : ''})`
    );
    if (!dbVersions) {
        console.log('   ⚠️  No database reached — a number free in the repo can still be taken on the');
        console.log('      target DB, where a duplicate is SKIPPED silently rather than failing.');
    }

    // Numbers >= 1000 are a separate legacy/parallel track (e.g. 1000, 1016-1021) that
    // exist only as DB records, not files. Ignore them when picking the next sequential
    // number, but still treat them as "used" so we never collide.
    const SEQUENTIAL_MAX = 1000;
    const sequentialUsed = [...usedNumbers].filter(n => n < SEQUENTIAL_MAX);
    const lastNumber = sequentialUsed.length ? Math.max(...sequentialUsed) : 0;

    // Next free number; defensive loop guarantees uniqueness against any used number.
    let nextNumber = lastNumber + 1;
    while (usedNumbers.has(nextNumber)) nextNumber++;

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

        // Sanity-check the whole migrations directory for duplicate numbers.
        try {
            require('./check-migration-numbers');
        } catch (e) {
            // check-migration-numbers calls process.exit(1) on a real violation; a thrown
            // error here would only be an unexpected runtime issue.
            console.warn('⚠️  Could not run migration-number check:', e.message);
        }

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