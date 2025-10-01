require('dotenv').config();
const { Pool } = require('pg');

async function checkSpecificCustomer() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const customerAddress = '0x0B96c2f730BfeCeb501C4AE95c0256FAa303981d';
    
    console.log('🔍 Checking all transactions for customer...\\n');
    
    // Check all transactions for this customer
    const txQuery = `
      SELECT 
        id,
        type,
        amount,
        shop_id,
        transaction_hash,
        timestamp,
        status,
        reason,
        metadata
      FROM transactions 
      WHERE LOWER(customer_address) = LOWER($1)
      ORDER BY timestamp DESC
    `;
    
    const txResult = await pool.query(txQuery, [customerAddress]);
    
    console.log(`Found ${txResult.rows.length} transactions:\\n`);
    
    let totalEarned = 0;
    let totalRedeemed = 0;
    
    txResult.rows.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type.toUpperCase()} - ${tx.amount} RCN`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Shop: ${tx.shop_id || 'N/A'}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Timestamp: ${new Date(tx.timestamp).toLocaleString()}`);
      console.log(`   TX Hash: ${tx.transaction_hash || 'Off-chain only'}`);
      console.log(`   Reason: ${tx.reason || 'N/A'}`);
      
      if (tx.status === 'confirmed') {
        if (tx.type === 'mint') {
          totalEarned += parseFloat(tx.amount);
        } else if (tx.type === 'redeem') {
          totalRedeemed += parseFloat(tx.amount);
        }
      }
      
      console.log('');
    });
    
    console.log('\\n📊 SUMMARY:');
    console.log(`Total Earned: ${totalEarned} RCN`);
    console.log(`Total Redeemed: ${totalRedeemed} RCN`);
    console.log(`Expected Balance: ${totalEarned - totalRedeemed} RCN`);
    
    // Check for duplicate transactions
    const duplicateQuery = `
      SELECT 
        amount,
        shop_id,
        timestamp,
        COUNT(*) as count
      FROM transactions
      WHERE LOWER(customer_address) = LOWER($1)
      AND type = 'mint'
      AND status = 'confirmed'
      GROUP BY amount, shop_id, timestamp
      HAVING COUNT(*) > 1
    `;
    
    const duplicateResult = await pool.query(duplicateQuery, [customerAddress]);
    
    if (duplicateResult.rows.length > 0) {
      console.log('\\n⚠️  DUPLICATE TRANSACTIONS FOUND:');
      duplicateResult.rows.forEach(dup => {
        console.log(`- ${dup.count} transactions of ${dup.amount} RCN from shop ${dup.shop_id} at ${dup.timestamp}`);
      });
    } else {
      console.log('\\n✅ No duplicate transactions found');
    }
    
  } catch (error) {
    console.error('Error checking customer:', error);
  } finally {
    await pool.end();
  }
}

checkSpecificCustomer();