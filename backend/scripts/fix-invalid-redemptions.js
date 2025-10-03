require('dotenv').config();
const { Pool } = require('pg');

async function fixInvalidRedemptions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Finding approved redemption sessions with insufficient balance...\n');
    
    // Find all approved redemption sessions
    const sessionQuery = `
      SELECT 
        rs.session_id,
        rs.customer_address,
        rs.shop_id,
        rs.max_amount,
        rs.status,
        rs.created_at,
        rs.approved_at,
        c.lifetime_earnings,
        COALESCE(
          (SELECT SUM(amount) 
           FROM transactions 
           WHERE LOWER(customer_address) = LOWER(rs.customer_address)
           AND type = 'redeem'
           AND status = 'confirmed'), 0
        ) as total_redeemed
      FROM redemption_sessions rs
      JOIN customers c ON LOWER(c.address) = LOWER(rs.customer_address)
      WHERE rs.status = 'approved'
      AND rs.used_at IS NULL
      ORDER BY rs.created_at DESC
    `;
    
    const sessionResult = await pool.query(sessionQuery);
    
    if (sessionResult.rows.length === 0) {
      console.log('✅ No approved redemption sessions found.');
      return;
    }
    
    console.log(`Found ${sessionResult.rows.length} approved redemption sessions.\n`);
    
    let invalidSessions = [];
    
    for (const session of sessionResult.rows) {
      const availableBalance = parseFloat(session.lifetime_earnings) - parseFloat(session.total_redeemed);
      
      if (session.max_amount > availableBalance) {
        invalidSessions.push({
          ...session,
          availableBalance
        });
      }
    }
    
    if (invalidSessions.length === 0) {
      console.log('✅ All approved sessions have valid amounts.');
      return;
    }
    
    console.log(`❌ Found ${invalidSessions.length} invalid sessions:\n`);
    
    for (const session of invalidSessions) {
      console.log(`Session: ${session.session_id}`);
      console.log(`  Customer: ${session.customer_address}`);
      console.log(`  Requested: ${session.max_amount} RCN`);
      console.log(`  Available: ${session.availableBalance} RCN`);
      console.log(`  Deficit: ${(session.max_amount - session.availableBalance).toFixed(2)} RCN`);
      console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
      console.log('');
    }
    
    // Ask for confirmation
    console.log('Would you like to expire these invalid sessions? (yes/no)');
    
    // For automated runs, we'll automatically expire them
    const shouldExpire = process.env.AUTO_FIX === 'true' || process.argv.includes('--fix');
    
    if (shouldExpire) {
      console.log('\n🔄 Expiring invalid sessions...');
      
      const expireQuery = `
        UPDATE redemption_sessions
        SET status = 'expired',
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{expiredReason}',
              '"Insufficient customer balance"'
            )
        WHERE session_id = ANY($1::varchar[])
      `;
      
      const sessionIds = invalidSessions.map(s => s.session_id);
      const result = await pool.query(expireQuery, [sessionIds]);
      
      console.log(`\n✅ Expired ${result.rowCount} invalid redemption sessions.`);
    } else {
      console.log('\nTo fix these sessions, run: npm run fix-invalid-redemptions -- --fix');
    }
    
  } catch (error) {
    console.error('Error fixing redemptions:', error);
  } finally {
    await pool.end();
  }
}

// Add npm script support
if (require.main === module) {
  fixInvalidRedemptions();
}

module.exports = { fixInvalidRedemptions };