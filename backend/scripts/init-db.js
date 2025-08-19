const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
    // Use DATABASE_URL from environment
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        
        // Read and execute init.sql
        const initSql = fs.readFileSync(path.join(__dirname, '../src/database/init.sql'), 'utf8');
        console.log('Executing init.sql...');
        await pool.query(initSql);
        console.log('✅ Base schema created');

        // Read and execute referral system migration
        const referralSql = fs.readFileSync(path.join(__dirname, '../migrations/create_referral_system.sql'), 'utf8');
        console.log('Executing referral system migration...');
        await pool.query(referralSql);
        console.log('✅ Referral system tables created');

        // Read and execute redemption sessions migration
        const redemptionSql = fs.readFileSync(path.join(__dirname, '../migrations/008_create_redemption_sessions.sql'), 'utf8');
        console.log('Executing redemption sessions migration...');
        await pool.query(redemptionSql);
        console.log('✅ Redemption sessions table created');

        // Check tables
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('\n📊 Database tables created:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        console.log('\n✨ Database initialization complete!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };