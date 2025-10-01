require('dotenv').config();
const { TokenMinter } = require('../src/contracts/TokenMinter');
const { Pool } = require('pg');

async function fixCustomerTokens() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const customerAddress = '0x0B96c2f730BfeCeb501C4AE95c0256FAa303981d';
    
    console.log('🔧 Fixing customer tokens...\n');
    
    // Check what they should have
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
    
    const expectedBalance = parseFloat(balance.total_earned || 0) - parseFloat(balance.total_redeemed || 0);
    console.log('📊 Customer should have:', expectedBalance, 'RCN');
    
    // Check on-chain balance
    const minter = new TokenMinter();
    const onChainBalance = await minter.getCustomerBalance(customerAddress);
    console.log('📊 Customer currently has:', onChainBalance || 0, 'RCN');
    
    const tokensToTransfer = expectedBalance - (onChainBalance || 0);
    
    if (tokensToTransfer > 0) {
      console.log(`\n💸 Need to transfer: ${tokensToTransfer} RCN`);
      
      // Transfer the missing tokens
      const result = await minter.transferTokens(
        customerAddress,
        tokensToTransfer,
        `Correction: Transfer missing tokens from previous rewards`
      );
      
      if (result.success) {
        console.log(`✅ Successfully transferred ${tokensToTransfer} RCN to customer`);
        console.log('Transaction hash:', result.transactionHash);
        
        // Verify new balance
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmation
        const newBalance = await minter.getCustomerBalance(customerAddress);
        console.log('\n📊 New customer balance:', newBalance || 0, 'RCN');
        
        // Update recent transactions to mark them as on-chain
        const updateQuery = `
          UPDATE transactions 
          SET 
            metadata = jsonb_set(
              COALESCE(metadata, '{}')::jsonb, 
              '{correctionApplied}', 
              'true'
            )
          WHERE LOWER(customer_address) = LOWER($1)
          AND type = 'mint'
          AND transaction_hash LIKE 'offchain_%'
        `;
        
        await pool.query(updateQuery, [customerAddress]);
        console.log('✅ Updated transaction records');
        
      } else {
        console.error('❌ Failed to transfer tokens:', result.error);
      }
    } else {
      console.log('✅ Customer already has the correct balance');
    }
    
  } catch (error) {
    console.error('Error fixing customer tokens:', error);
  } finally {
    await pool.end();
  }
}

fixCustomerTokens();