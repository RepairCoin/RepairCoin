import { Pool } from 'pg';
import { getTokenMinter } from '../src/contracts/TokenMinter';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixTokenDiscrepancies() {
  const discrepantCustomers = [
    {
      address: '0xe3e20bfa5a7edadb92fc89801bb756697b3c5640',
      missingAmount: 46,
      shops: '1111'
    },
    {
      address: '0xd68cc21abe3dc0e9d5bcc3736e25621c7d9b313c',
      missingAmount: 35,
      shops: 'zwift-tech'
    }
  ];

  console.log('🔧 Fixing token discrepancies for affected customers...\n');
  
  const tokenMinter = getTokenMinter();
  
  for (const customer of discrepantCustomers) {
    console.log(`\n📍 Processing customer: ${customer.address}`);
    console.log(`   Missing amount: ${customer.missingAmount} RCN`);
    console.log(`   Earned from shops: ${customer.shops}`);
    
    try {
      // Attempt to transfer tokens on-chain
      const result = await tokenMinter.transferTokens(
        customer.address,
        customer.missingAmount,
        `Admin fix for missing tokens - shops: ${customer.shops}`
      );
      
      if (result.success) {
        console.log(`   ✅ Successfully transferred ${customer.missingAmount} RCN`);
        console.log(`   Transaction hash: ${result.transactionHash}`);
        
        // Record the admin action in the database
        await pool.query(`
          INSERT INTO transactions (
            id, type, customer_address, amount, 
            balance_after, status, reference_id, 
            blockchain_tx_hash, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
        `, [
          `admin_fix_${Date.now()}_${customer.address}`,
          'transfer',
          customer.address.toLowerCase(),
          customer.missingAmount,
          0, // We don't know the exact balance after
          'confirmed',
          'admin_fix_discrepancy',
          result.transactionHash,
          JSON.stringify({
            reason: 'Fix token discrepancy',
            shops: customer.shops,
            admin: process.env.ADMIN_ADDRESSES?.split(',')[0]
          })
        ]);
        
        console.log('   📝 Transaction recorded in database');
      } else {
        console.error(`   ❌ Failed to transfer tokens: ${result.error}`);
        console.log('   🔄 Will need to retry or fix manually');
      }
    } catch (error: any) {
      console.error(`   ❌ Error processing customer: ${error.message}`);
    }
  }
  
  console.log('\n✅ Discrepancy fix process completed');
  console.log('\nNext steps:');
  console.log('1. Check customer wallets to verify tokens were received');
  console.log('2. Refresh the admin dashboard to see updated discrepancies');
  console.log('3. Investigate why auto-minting failed initially');
}

fixTokenDiscrepancies()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });