const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function checkMigrations() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'repaircoin',
        database: process.env.DB_NAME || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123',
        port: process.env.DB_PORT || 5432
    });

    try {
        // Check if schema_migrations table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'schema_migrations'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('⚠️  Migration tracking table does not exist.');
            console.log('Run: npm run db:migrate to create it.');
            process.exit(1);
        }

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
            .filter(m => !isNaN(m.version))
            .sort((a, b) => a.version - b.version);
        
        // Check for unapplied migrations
        const unapplied = migrations.filter(m => !applied.has(m.version));
        
        console.log('📊 Migration Status:');
        console.log(`   Total migrations: ${migrations.length}`);
        console.log(`   Applied: ${applied.size}`);
        console.log(`   Pending: ${unapplied.length}`);
        
        if (unapplied.length > 0) {
            console.log('\n⚠️  Unapplied migrations detected:');
            unapplied.forEach(m => console.log(`   - ${m.file}`));
            console.log('\n💡 Run: npm run db:migrate');
            process.exit(1);
        } else {
            console.log('\n✅ All migrations are up to date');
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Could not connect to database. Is PostgreSQL running?');
        } else {
            console.error('❌ Error checking migrations:', error.message);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    checkMigrations();
}

module.exports = checkMigrations;