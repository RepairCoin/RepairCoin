require('dotenv').config();
const { TokenMinter } = require('../src/contracts/TokenMinter');

async function mintToAdmin() {
  try {
    console.log('🔧 Minting tokens to admin wallet...\n');
    
    const minter = new TokenMinter();
    
    // Mint 10,000 RCN to admin wallet for distribution
    const amount = 10000;
    const result = await minter.adminMintTokens(
      '0x761E5E59485ec6feb263320f5d636042bD9EBc8c', // Admin wallet address
      amount,
      'Initial admin wallet funding for customer rewards'
    );
    
    if (result.success) {
      console.log(`✅ Successfully minted ${amount} RCN to admin wallet`);
      console.log('Transaction hash:', result.transactionHash);
      
      // Check new balance
      const newBalance = await minter.getCustomerBalance('0x761E5E59485ec6feb263320f5d636042bD9EBc8c');
      console.log('New admin wallet balance:', newBalance || 0, 'RCN');
    } else {
      console.error('❌ Failed to mint tokens:', result.error);
    }
    
  } catch (error) {
    console.error('Error minting to admin:', error);
  }
}

mintToAdmin();