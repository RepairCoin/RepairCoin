require('dotenv').config();
const { Pool } = require('pg');

async function checkRedemptions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const customerAddress = '0x0B96c2f730BfeCeb501C4AE95c0256FAa303981d';
    
    console.log('🔍 Checking redemptions for customer...\n');
    
    // Get customer data
    const customerQuery = `
      SELECT 
        address,
        lifetime_earnings,
        daily_earnings,
        monthly_earnings
      FROM customers 
      WHERE LOWER(address) = LOWER($1)
    `;
    
    const customerResult = await pool.query(customerQuery, [customerAddress]);
    const customer = customerResult.rows[0];
    
    if (customer) {
      console.log('📊 CUSTOMER DATA:');
      console.log('- Lifetime Earnings:', parseFloat(customer.lifetime_earnings), 'RCN');
      console.log('- Daily Earnings:', parseFloat(customer.daily_earnings || 0), 'RCN');
      console.log('- Monthly Earnings:', parseFloat(customer.monthly_earnings || 0), 'RCN');
    }
    
    // Get all redemption transactions
    const redemptionQuery = `
      SELECT 
        id,
        amount,
        shop_id,
        timestamp,
        status,
        metadata
      FROM transactions 
      WHERE LOWER(customer_address) = LOWER($1)
      AND type = 'redeem'
      ORDER BY timestamp DESC
    `;
    
    const redemptionResult = await pool.query(redemptionQuery, [customerAddress]);
    
    console.log('\n📊 REDEMPTION TRANSACTIONS:');
    console.log(`Found ${redemptionResult.rows.length} redemptions`);
    
    let totalRedeemedFromTransactions = 0;
    redemptionResult.rows.forEach((redemption, index) => {
      console.log(`\n${index + 1}. Amount: ${redemption.amount} RCN`);
      console.log(`   Shop: ${redemption.shop_id}`);
      console.log(`   Status: ${redemption.status}`);
      console.log(`   Timestamp: ${new Date(redemption.timestamp).toLocaleString()}`);
      
      if (redemption.status === 'confirmed') {
        totalRedeemedFromTransactions += parseFloat(redemption.amount);
      }
    });
    
    console.log('\n💰 BALANCE CALCULATION:');
    console.log('- Lifetime Earnings:', parseFloat(customer.lifetime_earnings), 'RCN');
    console.log('- Total Redeemed (from transactions):', totalRedeemedFromTransactions, 'RCN');
    console.log('- Expected Balance:', parseFloat(customer.lifetime_earnings) - totalRedeemedFromTransactions, 'RCN');
    
    // Check redemption sessions
    const sessionQuery = `
      SELECT 
        session_id,
        shop_id,
        max_amount,
        status,
        created_at,
        approved_at,
        used_at
      FROM redemption_sessions
      WHERE LOWER(customer_address) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const sessionResult = await pool.query(sessionQuery, [customerAddress]);
    
    console.log('\n📋 RECENT REDEMPTION SESSIONS:');
    sessionResult.rows.forEach((session, index) => {
      console.log(`\n${index + 1}. Session: ${session.session_id.substring(0, 8)}...`);
      console.log(`   Amount: ${session.max_amount} RCN`);
      console.log(`   Shop: ${session.shop_id}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
      if (session.approved_at) {
        console.log(`   Approved: ${new Date(session.approved_at).toLocaleString()}`);
      }
      if (session.used_at) {
        console.log(`   Used: ${new Date(session.used_at).toLocaleString()}`);
      }
    });
    
  } catch (error) {
    console.error('Error checking redemptions:', error);
  } finally {
    await pool.end();
  }
}

checkRedemptions();