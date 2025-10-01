require('dotenv').config();
const { Pool } = require('pg');

async function checkCustomerStatus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const customerAddress = '0x0B96c2f730BfeCeb501C4AE95c0256FAa303981d';
    
    console.log('🔍 Checking customer status...\n');
    
    // Check customer data
    const customerQuery = `
      SELECT 
        address, 
        lifetime_earnings, 
        daily_earnings, 
        monthly_earnings,
        tier,
        is_active,
        last_earned_date
      FROM customers 
      WHERE LOWER(address) = LOWER($1)
    `;
    
    const customerResult = await pool.query(customerQuery, [customerAddress]);
    
    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      console.log('📊 CUSTOMER DATA:');
      console.log('- Address:', customer.address);
      console.log('- Lifetime Earnings:', parseFloat(customer.lifetime_earnings), 'RCN');
      console.log('- Daily Earnings:', parseFloat(customer.daily_earnings), 'RCN');
      console.log('- Monthly Earnings:', parseFloat(customer.monthly_earnings), 'RCN');
      console.log('- Tier:', customer.tier);
      console.log('- Active:', customer.is_active);
      console.log('- Last Earned:', customer.last_earned_date);
    }
    
    // Check recent transactions
    const txQuery = `
      SELECT 
        id,
        type, 
        amount, 
        shop_id,
        transaction_hash,
        timestamp,
        metadata
      FROM transactions 
      WHERE LOWER(customer_address) = LOWER($1)
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    
    const txResult = await pool.query(txQuery, [customerAddress]);
    
    console.log('\n📊 RECENT TRANSACTIONS:');
    txResult.rows.forEach((tx, index) => {
      console.log(`\n${index + 1}. ${tx.type.toUpperCase()} - ${tx.amount} RCN`);
      console.log('   Shop:', tx.shop_id || 'N/A');
      console.log('   Timestamp:', tx.timestamp);
      console.log('   TX Hash:', tx.transaction_hash || 'Off-chain only');
      const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
      if (metadata && metadata.onChainTransfer !== undefined) {
        console.log('   On-chain Transfer:', metadata.onChainTransfer);
      }
    });
    
    // Calculate what they should have
    const balanceQuery = `
      SELECT 
        SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as total_redeemed
      FROM transactions 
      WHERE LOWER(customer_address) = LOWER($1)
      AND status = 'confirmed'
    `;
    
    const balanceResult = await pool.query(balanceQuery, [customerAddress]);
    const balance = balanceResult.rows[0];
    
    console.log('\n💰 EXPECTED BALANCE:');
    console.log('- Total Earned:', parseFloat(balance.total_earned || 0), 'RCN');
    console.log('- Total Redeemed:', parseFloat(balance.total_redeemed || 0), 'RCN');
    console.log('- Expected Balance:', parseFloat(balance.total_earned || 0) - parseFloat(balance.total_redeemed || 0), 'RCN');
    
  } catch (error) {
    console.error('Error checking customer status:', error);
  } finally {
    await pool.end();
  }
}

checkCustomerStatus();