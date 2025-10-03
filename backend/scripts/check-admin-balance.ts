import { getTokenMinter } from '../src/contracts/TokenMinter';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkAdminBalance() {
  console.log('🔍 Checking Admin Wallet RCN Balance...\n');
  
  const adminAddress = process.env.ADMIN_ADDRESSES?.split(',')[0];
  
  if (!adminAddress) {
    console.error('❌ No admin address found in environment variables');
    return;
  }
  
  console.log(`Admin Wallet: ${adminAddress}`);
  
  try {
    const tokenMinter = getTokenMinter();
    const balance = await tokenMinter.getCustomerBalance(adminAddress);
    
    console.log(`\n💰 RCN Balance: ${balance} RCN`);
    
    if (balance === 0 || balance === null) {
      console.log('\n⚠️  WARNING: Admin wallet has NO RCN tokens!');
      console.log('This is why transfers are failing!');
      console.log('\nTo fix this:');
      console.log('1. The admin wallet needs to have RCN tokens to transfer to customers');
      console.log('2. You can mint tokens to the admin wallet first');
      console.log('3. Or switch to using mintTokens() instead of transferTokens()');
    } else if (balance < 1000) {
      console.log('\n⚠️  WARNING: Admin wallet has low RCN balance');
      console.log('Consider minting more tokens to ensure smooth operations');
    } else {
      console.log('\n✅ Admin wallet has sufficient RCN balance');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error);
  }
}

checkAdminBalance()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });