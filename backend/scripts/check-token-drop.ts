import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import * as dotenv from 'dotenv';

dotenv.config();

const RCG_CONTRACT_ADDRESS = '0x973D8b27E7CD72270F9C07d94381f522bC9D4304';
const YOUR_WALLET = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';

async function checkTokenDrop() {
  try {
    console.log('🔍 Checking Token Drop Contract Details...\n');
    
    const client = createThirdwebClient({
      clientId: process.env.RCG_THIRDWEB_CLIENT_ID || '',
      secretKey: process.env.RCG_THIRDWEB_SECRET_KEY || '',
    });

    const contract = getContract({
      client,
      address: RCG_CONTRACT_ADDRESS,
      chain: baseSepolia,
    });

    console.log('📋 Contract Type: Token Drop (Claim-based distribution)');
    console.log('📍 Address:', RCG_CONTRACT_ADDRESS);
    console.log('👛 Your Wallet:', YOUR_WALLET);
    console.log('\n');

    // Token Drop specific checks
    try {
      // Check claim conditions
      const activeClaimCondition = await readContract({
        contract,
        method: 'function getActiveClaimConditionId() returns (uint256)',
        params: [],
      });
      console.log('Active Claim Condition ID:', activeClaimCondition.toString());
    } catch (e) {
      console.log('❌ No active claim conditions found');
    }

    try {
      // Check if claiming is active
      const claimCondition = await readContract({
        contract,
        method: 'function claimCondition() returns (uint256 currentStartId, uint256 count)',
        params: [],
      });
      console.log('Claim Conditions Set:', claimCondition[1] > 0 ? '✅ YES' : '❌ NO');
    } catch (e) {
      // Different interface
    }

    try {
      // Check total claimed
      const totalClaimed = await readContract({
        contract,
        method: 'function totalClaimed() returns (uint256)',
        params: [],
      });
      console.log('Total Tokens Claimed:', (BigInt(totalClaimed) / BigInt(10**18)).toString(), 'RCG');
    } catch (e) {
      console.log('Could not read total claimed');
    }

    try {
      // Check max claimable supply
      const maxTotalSupply = await readContract({
        contract,
        method: 'function maxTotalSupply() returns (uint256)',
        params: [],
      });
      console.log('Max Total Supply:', (BigInt(maxTotalSupply) / BigInt(10**18)).toString(), 'RCG');
    } catch (e) {
      console.log('No max supply limit');
    }

    console.log('\n📚 Token Drop Contract Explanation:');
    console.log('Token Drop contracts work differently than standard ERC20:');
    console.log('1. They use "claim" instead of "mint"');
    console.log('2. You need to set up claim conditions first');
    console.log('3. Users claim tokens based on conditions (whitelist, public, etc.)');
    console.log('4. Direct minting (mintTo) is usually not available');
    
    console.log('\n💡 For Testing, You Should:');
    console.log('1. Deploy a standard ERC20 token instead of Token Drop');
    console.log('2. Visit: https://thirdweb.com/thirdweb.eth/TokenERC20/deploy');
    console.log('3. This will give you a token with direct minting capability');
    console.log('4. Update your RCG_CONTRACT_ADDRESS in .env');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTokenDrop().catch(console.error);