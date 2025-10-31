// Check RCN token balance
// Run with: node check-balance.js

const { ethers } = require('ethers');

const RCN_CONTRACT = '0xBFE793d78B6B83859b528F191bd6F2b8555D951C';
const TEST_ADDRESS = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';

const ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)'
];

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const contract = new ethers.Contract(RCN_CONTRACT, ABI, provider);

  try {
    const [balance, decimals, name, symbol] = await Promise.all([
      contract.balanceOf(TEST_ADDRESS),
      contract.decimals(),
      contract.name(),
      contract.symbol()
    ]);

    const formattedBalance = ethers.formatUnits(balance, decimals);

    console.log('✅ Token Details:');
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);
    console.log('');
    console.log('💰 Balance for', TEST_ADDRESS);
    console.log('   Raw:', balance.toString());
    console.log('   Formatted:', formattedBalance, symbol);

    if (parseFloat(formattedBalance) >= 100) {
      console.log('');
      console.log('🎉 Multi-sig mint test SUCCESSFUL!');
      console.log('   The Safe successfully minted 100+ RCN tokens');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBalance();
