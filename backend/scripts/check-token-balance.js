require('dotenv').config();
const { TokenMinter } = require('../src/contracts/TokenMinter');
const { privateKeyToAccount } = require("thirdweb/wallets");
const { createThirdwebClient } = require("thirdweb");

async function checkBalance() {
  try {
    console.log('🔍 Checking token balances...\n');
    
    const minter = new TokenMinter();
    
    // Get admin wallet address from private key
    const privateKey = process.env.PRIVATE_KEY;
    const clientId = process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    const secretKey = process.env.RCN_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY;
    
    const client = createThirdwebClient({
      clientId: clientId,
      secretKey: secretKey,
    });
    
    const account = privateKeyToAccount({
      client: client,
      privateKey: privateKey,
    });
    
    const adminAddress = account.address;
    console.log('Admin wallet address:', adminAddress);
    
    // Check admin balance
    const adminBalance = await minter.getCustomerBalance(adminAddress);
    console.log('Admin wallet RCN balance:', adminBalance || 0, 'RCN');
    
    // Check specific customer balance
    const customerAddress = '0x0B96c2f730BfeCeb501C4AE95c0256FAa303981d';
    const customerBalance = await minter.getCustomerBalance(customerAddress);
    console.log(`Customer ${customerAddress} balance:`, customerBalance || 0, 'RCN');
    
    // Get contract stats
    const stats = await minter.getContractStats();
    console.log('\nContract Stats:');
    console.log('- Contract Address:', stats.contractAddress);
    console.log('- Total Supply:', stats.totalSupplyReadable, 'RCN');
    console.log('- Is Paused:', stats.isPaused);
    
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

checkBalance();