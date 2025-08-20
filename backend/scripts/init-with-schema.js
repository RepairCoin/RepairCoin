const { Pool } = require('pg');

async function initDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        
        // Try to create our own schema
        const schemaName = 'repaircoin';
        
        console.log(`Creating schema ${schemaName}...`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        
        // Set search path
        await pool.query(`SET search_path TO ${schemaName}, public`);
        
        // Create tables in our schema
        console.log('Creating customers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
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
            CREATE TABLE IF NOT EXISTS ${schemaName}.shops (
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
        
        // Update search_path for the database user permanently
        await pool.query(`ALTER DATABASE ${pool.options.database} SET search_path TO ${schemaName}, public`);
        
        console.log(`\n✨ Schema ${schemaName} created with basic tables!`);
        console.log(`\n⚠️  IMPORTANT: Update your DATABASE_URL to include the schema:`);
        console.log(`DATABASE_URL=postgresql://...?schema=${schemaName}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // If schema creation fails, let's just work with what we have
        if (error.message.includes('permission denied')) {
            console.log('\n🔧 Alternative solution:');
            console.log('Contact DigitalOcean support to grant CREATE permissions on the public schema');
            console.log('Or use their database user with higher privileges');
        }
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };