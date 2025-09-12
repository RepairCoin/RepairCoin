import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { privateKeyToAccount } from 'thirdweb/wallets';
import * as dotenv from 'dotenv';

dotenv.config();

const RCG_CONTRACT_ADDRESS = '0x973D8b27E7CD72270F9C07d94381f522bC9D4304';
const YOUR_WALLET = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';

async function checkRCGContract() {
  try {
    console.log('🔍 Checking RCG Contract Details...\n');
    
    // Initialize Thirdweb client
    const client = createThirdwebClient({
      clientId: process.env.RCG_THIRDWEB_CLIENT_ID || '',
      secretKey: process.env.RCG_THIRDWEB_SECRET_KEY || '',
    });

    // Get the token contract
    const contract = getContract({
      client,
      address: RCG_CONTRACT_ADDRESS,
      chain: baseSepolia,
    });

    // Try to read various contract methods
    console.log('📋 Contract Address:', RCG_CONTRACT_ADDRESS);
    console.log('👛 Your Wallet:', YOUR_WALLET);
    console.log('🌐 Network: Base Sepolia\n');

    try {
      // Check basic token info
      const [name, symbol, decimals] = await Promise.all([
        readContract({ contract, method: 'function name() returns (string)', params: [] }),
        readContract({ contract, method: 'function symbol() returns (string)', params: [] }),
        readContract({ contract, method: 'function decimals() returns (uint8)', params: [] }),
      ]);
      
      console.log('Token Info:');
      console.log(`  Name: ${name}`);
      console.log(`  Symbol: ${symbol}`);
      console.log(`  Decimals: ${decimals}\n`);
    } catch (e) {
      console.log('❌ Could not read basic token info\n');
    }

    try {
      // Check if contract has owner
      const owner = await readContract({
        contract,
        method: 'function owner() returns (address)',
        params: [],
      });
      console.log('Contract Owner:', owner);
      console.log('You are owner:', owner.toLowerCase() === YOUR_WALLET.toLowerCase() ? '✅ YES' : '❌ NO');
    } catch (e) {
      console.log('⚠️  No owner() function found - might use different access control\n');
    }

    try {
      // Check for role-based access (common in Thirdweb contracts)
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const hasAdminRole = await readContract({
        contract,
        method: 'function hasRole(bytes32 role, address account) returns (bool)',
        params: [DEFAULT_ADMIN_ROLE, YOUR_WALLET],
      });
      console.log('Has Admin Role:', hasAdminRole ? '✅ YES' : '❌ NO');
    } catch (e) {
      console.log('⚠️  No role-based access control found\n');
    }

    try {
      // Check minting permissions
      const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
      const hasMinterRole = await readContract({
        contract,
        method: 'function hasRole(bytes32 role, address account) returns (bool)',
        params: [MINTER_ROLE, YOUR_WALLET],
      });
      console.log('Has Minter Role:', hasMinterRole ? '✅ YES' : '❌ NO\n');
    } catch (e) {
      // Try different minting check
    }

    console.log('\n🔗 View on Explorer:');
    console.log(`https://sepolia.basescan.org/address/${RCG_CONTRACT_ADDRESS}`);
    
    console.log('\n💡 Next Steps:');
    console.log('1. If you don\'t have minting permissions, you need to:');
    console.log('   - Deploy a new RCG token with your wallet as owner/minter');
    console.log('   - Or get minting permissions from the current contract owner');
    console.log('2. Use Thirdweb dashboard to deploy a new token if needed:');
    console.log('   https://thirdweb.com/dashboard/contracts/deploy');

  } catch (error) {
    console.error('❌ Error checking contract:', error);
  }
}

// Run the check
checkRCGContract().catch(console.error);