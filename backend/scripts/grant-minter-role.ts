import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { privateKeyToAccount } from 'thirdweb/wallets';
import * as dotenv from 'dotenv';

dotenv.config();

const RCG_CONTRACT_ADDRESS = '0x973D8b27E7CD72270F9C07d94381f522bC9D4304';
const YOUR_WALLET = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

async function grantMinterRole() {
  try {
    console.log('🔐 Granting Minter Role...\n');
    
    // Initialize Thirdweb client
    const client = createThirdwebClient({
      clientId: process.env.RCG_THIRDWEB_CLIENT_ID || '',
      secretKey: process.env.RCG_THIRDWEB_SECRET_KEY || '',
    });

    // Get account from private key
    const account = privateKeyToAccount({
      client,
      privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    });

    // Get the token contract
    const contract = getContract({
      client,
      address: RCG_CONTRACT_ADDRESS,
      chain: baseSepolia,
    });

    console.log('📋 Contract:', RCG_CONTRACT_ADDRESS);
    console.log('👛 Granting to:', YOUR_WALLET);
    console.log('🔑 Using account:', account.address);
    console.log('🎯 Minter Role:', MINTER_ROLE);

    // Prepare the grantRole transaction
    const transaction = prepareContractCall({
      contract,
      method: 'function grantRole(bytes32 role, address account)',
      params: [MINTER_ROLE, YOUR_WALLET],
    });

    // Send transaction
    console.log('\n⏳ Sending transaction...');
    const result = await sendTransaction({
      transaction,
      account,
    });

    console.log('✅ Transaction submitted!');
    console.log('📜 Transaction Hash:', result.transactionHash);
    console.log('🔗 View on BaseScan: https://sepolia.basescan.org/tx/' + result.transactionHash);
    
    console.log('\n✨ Minter role granted! You can now run npm run mint:rcg');

  } catch (error) {
    console.error('❌ Error granting minter role:', error);
    console.log('\n💡 If this fails, you may need to:');
    console.log('1. Deploy your own RCG token contract');
    console.log('2. Visit: https://thirdweb.com/dashboard/contracts/deploy');
    console.log('3. Choose "Token" template and deploy with your settings');
  }
}

// Run the grant
grantMinterRole().catch(console.error);