require('dotenv').config();
const { TokenMinter } = require('../src/contracts/TokenMinter');
const { Pool } = require('pg');

async function checkDiscrepancy() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Checking Treasury Discrepancy...\n');
    
    // 1. Check on-chain data
    const minter = new TokenMinter();
    const adminAddress = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
    
    const adminBalance = await minter.getCustomerBalance(adminAddress);
    const stats = await minter.getContractStats();
    
    console.log('📊 ON-CHAIN DATA:');
    console.log('- Total Supply:', stats.totalSupplyReadable, 'RCN');
    console.log('- Admin Wallet Balance:', adminBalance || 0, 'RCN');
    
    // 2. Check database treasury data
    const treasuryQuery = `
      SELECT 
        SUM(CASE WHEN type = 'mint' AND customer_address != $1 THEN amount ELSE 0 END) as total_minted_to_customers,
        SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as total_redeemed,
        SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as total_issued_by_shops
      FROM transactions
      WHERE status = 'confirmed'
    `;
    
    const treasuryResult = await pool.query(treasuryQuery, [adminAddress.toLowerCase()]);
    const treasury = treasuryResult.rows[0];
    
    console.log('\n📊 DATABASE TRACKING:');
    console.log('- Total Minted to Customers:', parseFloat(treasury.total_minted_to_customers || 0), 'RCN');
    console.log('- Total Redeemed:', parseFloat(treasury.total_redeemed || 0), 'RCN');
    console.log('- Total Issued by Shops:', parseFloat(treasury.total_issued_by_shops || 0), 'RCN');
    
    // 3. Check shop balances
    const shopQuery = `
      SELECT 
        SUM(purchased_rcn_balance) as total_shop_balances,
        SUM(total_rcn_purchased) as total_purchased_by_shops
      FROM shops
    `;
    
    const shopResult = await pool.query(shopQuery);
    const shopData = shopResult.rows[0];
    
    console.log('\n📊 SHOP BALANCES:');
    console.log('- Total Shop Off-chain Balances:', parseFloat(shopData.total_shop_balances || 0), 'RCN');
    console.log('- Total Purchased by Shops:', parseFloat(shopData.total_purchased_by_shops || 0), 'RCN');
    
    // 4. Calculate discrepancies
    console.log('\n⚠️  DISCREPANCY ANALYSIS:');
    const expectedAdminBalance = parseFloat(shopData.total_purchased_by_shops || 0) - parseFloat(treasury.total_issued_by_shops || 0);
    console.log('- Expected Admin Balance (from shop purchases - issued):', expectedAdminBalance, 'RCN');
    console.log('- Actual Admin On-chain Balance:', adminBalance || 0, 'RCN');
    console.log('- Discrepancy:', (adminBalance || 0) - expectedAdminBalance, 'RCN');
    
    // 5. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (adminBalance > expectedAdminBalance) {
      console.log('1. Admin wallet has MORE tokens than expected from shop purchases');
      console.log('2. This is because we manually minted 10,000 RCN to admin');
      console.log('3. Options:');
      console.log('   a) Record the manual mint in the database');
      console.log('   b) Burn the excess tokens');
      console.log('   c) Keep as reserve for future operations');
    }
    
  } catch (error) {
    console.error('Error checking discrepancy:', error);
  } finally {
    await pool.end();
  }
}

checkDiscrepancy();