const { Pool } = require('pg');

async function initDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        
        // Check current user
        const userResult = await pool.query('SELECT current_user');
        console.log('Connected as user:', userResult.rows[0].current_user);
        
        // Try to create a simple test table first
        console.log('Testing table creation...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS test_permissions (
                id SERIAL PRIMARY KEY,
                test_field VARCHAR(100)
            )
        `);
        console.log('✅ Test table created successfully!');
        
        // Drop test table
        await pool.query('DROP TABLE IF EXISTS test_permissions');
        
        // Now create each table individually
        console.log('Creating customers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                address VARCHAR(42) PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(20),
                wallet_address VARCHAR(42) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                lifetime_earnings NUMERIC(20, 8) DEFAULT 0,
                tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD')),
                daily_earnings NUMERIC(20, 8) DEFAULT 0,
                monthly_earnings NUMERIC(20, 8) DEFAULT 0,
                last_earned_date DATE DEFAULT CURRENT_DATE,
                referral_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Customers table created');
        
        console.log('Creating shops table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shops (
                shop_id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                wallet_address VARCHAR(42) NOT NULL,
                reimbursement_address VARCHAR(42),
                verified BOOLEAN DEFAULT false,
                active BOOLEAN DEFAULT true,
                cross_shop_enabled BOOLEAN DEFAULT false,
                total_tokens_issued NUMERIC(20, 8) DEFAULT 0,
                total_redemptions NUMERIC(20, 8) DEFAULT 0,
                total_reimbursements NUMERIC(20, 8) DEFAULT 0,
                join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fixflow_shop_id VARCHAR(100),
                location_lat NUMERIC(10, 8),
                location_lng NUMERIC(11, 8),
                location_city VARCHAR(100),
                location_state VARCHAR(100),
                location_zip_code VARCHAR(20),
                purchased_rcn_balance NUMERIC(20, 8) DEFAULT 0,
                total_rcn_purchased NUMERIC(20, 8) DEFAULT 0,
                last_purchase_date TIMESTAMP,
                minimum_balance_alert NUMERIC(20, 8) DEFAULT 50,
                auto_purchase_enabled BOOLEAN DEFAULT false,
                auto_purchase_amount NUMERIC(20, 8) DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Shops table created');
        
        // List all tables
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        console.log('\n📊 Current database tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        console.log('\n✨ Basic tables created! Run the full init script when permissions are fixed.');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Error detail:', error.detail);
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