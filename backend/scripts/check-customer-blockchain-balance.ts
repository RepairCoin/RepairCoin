import { getTokenMinter } from '../src/contracts/TokenMinter';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkCustomerBalance(customerAddress: string) {
  console.log(`🔍 Checking blockchain balance for customer: ${customerAddress}\n`);
  
  try {
    const tokenMinter = getTokenMinter();
    const balance = await tokenMinter.getCustomerBalance(customerAddress);
    
    console.log(`💰 Blockchain Balance: ${balance || 0} RCN`);
    console.log(`📊 Database shows: 10 RCN earned, 0 redeemed`);
    
    if (!balance || balance === 0) {
      console.log('\n❌ Customer has NO tokens on blockchain!');
      console.log('This confirms the tokens were not minted.');
      
      console.log('\nPossible reasons:');
      console.log('1. Blockchain minting was disabled when reward was issued');
      console.log('2. The minting transaction failed');
      console.log('3. Network issues prevented the transaction');
      
      console.log('\n✅ Solution: Run the fix script to mint the missing tokens');
    } else {
      console.log(`\n✅ Customer has ${balance} RCN on blockchain`);
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error);
  }
}

// Check the specific customer
checkCustomerBalance('0xC81B78A282aB5862E01c885B01773Aa72FFEd772')
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });