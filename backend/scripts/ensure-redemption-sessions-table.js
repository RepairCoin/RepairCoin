const { DatabaseService } = require('../src/services/DatabaseService');

async function ensureRedemptionSessionsTable() {
  try {
    const db = DatabaseService.getInstance();
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'redemption_sessions'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('Creating redemption_sessions table...');
      
      await db.query(`
        CREATE TABLE redemption_sessions (
          session_id VARCHAR(255) NOT NULL PRIMARY KEY,
          customer_address VARCHAR(42) NOT NULL,
          shop_id VARCHAR(100) NOT NULL,
          max_amount NUMERIC(20,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ NOT NULL,
          approved_at TIMESTAMPTZ,
          used_at TIMESTAMPTZ,
          qr_code TEXT,
          signature TEXT,
          metadata JSONB DEFAULT '{}'
        );
      `);
      
      // Create indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_redemption_sessions_customer ON redemption_sessions (customer_address);
        CREATE INDEX IF NOT EXISTS idx_redemption_sessions_shop ON redemption_sessions (shop_id);
        CREATE INDEX IF NOT EXISTS idx_redemption_sessions_status ON redemption_sessions (status);
        CREATE INDEX IF NOT EXISTS idx_redemption_sessions_expires ON redemption_sessions (expires_at);
        CREATE INDEX IF NOT EXISTS idx_redemption_sessions_active ON redemption_sessions (customer_address, status) 
        WHERE status IN ('pending', 'approved');
      `);
      
      console.log('✅ redemption_sessions table created successfully');
    } else {
      console.log('✅ redemption_sessions table already exists');
      
      // Check columns
      const columns = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'redemption_sessions' 
        ORDER BY ordinal_position
      `);
      
      console.log('Table columns:', columns.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Error ensuring redemption_sessions table:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  ensureRedemptionSessionsTable()
    .then(() => {
      console.log('✅ Database check complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database check failed:', error);
      process.exit(1);
    });
}

module.exports = ensureRedemptionSessionsTable;