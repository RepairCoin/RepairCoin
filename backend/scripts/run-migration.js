const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Use DATABASE_URL from environment or construct from individual vars
  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    console.log('Connected to database...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/create_referral_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running referral system migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table exists
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'customer_rcn_sources'
    `;
    
    const result = await pool.query(verifyQuery);
    if (result.rows.length > 0) {
      console.log('✅ customer_rcn_sources table created successfully');
    } else {
      console.log('❌ customer_rcn_sources table was not created');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();