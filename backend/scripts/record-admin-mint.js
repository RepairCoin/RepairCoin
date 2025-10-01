require('dotenv').config();
const { Pool } = require('pg');

async function recordAdminMint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📝 Recording admin mint in database...\n');
    
    const adminAddress = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
    const amount = 10000;
    const txHash = '0x91af007f8754ae53a42840e45693efb4d97fca3eb678c1fd227043be5741a1e3';
    
    // Insert the manual mint transaction
    const insertQuery = `
      INSERT INTO transactions (
        type, customer_address, shop_id, amount, reason, 
        transaction_hash, timestamp, status, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id
    `;
    
    const values = [
      'mint',
      adminAddress.toLowerCase(),
      null, // No shop_id for admin mints
      amount,
      'Manual mint for admin wallet funding',
      txHash,
      new Date().toISOString(),
      'confirmed',
      JSON.stringify({
        manual: true,
        purpose: 'admin_wallet_funding',
        note: 'Minted to provide liquidity for customer rewards',
        source: 'admin_system'
      })
    ];
    
    const result = await pool.query(insertQuery, values);
    const transactionId = result.rows[0].id;
    
    console.log('✅ Successfully recorded admin mint transaction');
    console.log('- Transaction ID:', transactionId);
    console.log('- Amount:', amount, 'RCN');
    console.log('- Transaction Hash:', txHash);
    
    // Verify the record
    const verifyQuery = `
      SELECT 
        SUM(CASE WHEN customer_address = $1 AND type = 'mint' THEN amount ELSE 0 END) as admin_mints,
        SUM(CASE WHEN type = 'mint' AND customer_address != $1 THEN amount ELSE 0 END) as customer_mints
      FROM transactions
      WHERE status = 'confirmed'
    `;
    
    const verifyResult = await pool.query(verifyQuery, [adminAddress.toLowerCase()]);
    console.log('\n📊 Updated totals:');
    console.log('- Admin mints:', parseFloat(verifyResult.rows[0].admin_mints || 0), 'RCN');
    console.log('- Customer mints:', parseFloat(verifyResult.rows[0].customer_mints || 0), 'RCN');
    
  } catch (error) {
    console.error('Error recording admin mint:', error);
  } finally {
    await pool.end();
  }
}

recordAdminMint();