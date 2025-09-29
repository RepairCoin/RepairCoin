import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import * as dotenv from 'dotenv';

dotenv.config();

const RCG_CONTRACT_ADDRESS = '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D';
const YOUR_WALLET = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

async function checkMinterStatus() {
  try {
    console.log('🔍 Checking Minter Status...\n');
    
    const client = createThirdwebClient({
      clientId: process.env.RCG_THIRDWEB_CLIENT_ID || '',
      secretKey: process.env.RCG_THIRDWEB_SECRET_KEY || '',
    });

    const contract = getContract({
      client,
      address: RCG_CONTRACT_ADDRESS,
      chain: baseSepolia,
    });

    // Wait a bit for transaction to be confirmed
    console.log('⏳ Waiting for role grant to be confirmed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check minter role again
    const hasMinterRole = await readContract({
      contract,
      method: 'function hasRole(bytes32 role, address account) returns (bool)',
      params: [MINTER_ROLE, YOUR_WALLET],
    });

    console.log('Has Minter Role:', hasMinterRole ? '✅ YES' : '❌ NO');

    if (hasMinterRole) {
      console.log('\n✅ You have minter role! The mint should work now.');
      console.log('If minting still fails, the contract might have additional restrictions like:');
      console.log('- Max supply already reached');
      console.log('- Minting is paused');
      console.log('- Contract has a different minting function');
    } else {
      console.log('\n❌ Minter role not granted yet.');
      console.log('Transaction might still be pending or failed.');
    }

    // Try to check if there's a max supply
    try {
      const maxSupply = await readContract({
        contract,
        method: 'function maxSupply() returns (uint256)',
        params: [],
      });
      console.log('\nMax Supply:', maxSupply.toString());
    } catch (e) {
      console.log('\nNo max supply limit found');
    }

    // Check if minting is paused
    try {
      const paused = await readContract({
        contract,
        method: 'function paused() returns (bool)',
        params: [],
      });
      console.log('Contract Paused:', paused ? '❌ YES' : '✅ NO');
    } catch (e) {
      // No pause function
    }

  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

checkMinterStatus().catch(console.error);