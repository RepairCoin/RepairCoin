import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { mintTo, balanceOf, totalSupply } from 'thirdweb/extensions/erc20';
import * as dotenv from 'dotenv';

dotenv.config();

const RCG_CONTRACT_ADDRESS = process.env.RCG_CONTRACT_ADDRESS || '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D';
const TARGET_WALLET = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
const MINT_AMOUNT = 100000000n * 10n ** 18n; // 100 million tokens with 18 decimals

async function mintRCGTokens() {
  try {
    console.log('🚀 Starting RCG token minting process...');
    
    const clientId = process.env.RCG_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || '';
    const secretKey = process.env.RCG_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY || '';
    
    if (!clientId || !secretKey) {
      throw new Error(`Missing Thirdweb credentials. ClientID: ${clientId ? 'Found' : 'Missing'}, SecretKey: ${secretKey ? 'Found' : 'Missing'}`);
    }
    
    console.log('📋 Using RCG Thirdweb credentials');
    
    // Initialize Thirdweb client with RCG-specific credentials
    const client = createThirdwebClient({
      clientId,
      secretKey,
    });

    // Get account from private key
    const account = privateKeyToAccount({
      client,
      privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    });

    console.log('📝 Contract Address:', RCG_CONTRACT_ADDRESS);
    console.log('👛 Target Wallet:', TARGET_WALLET);
    console.log('💰 Amount to Mint:', '100,000,000 RCG');
    console.log('🔑 Minting from:', account.address);

    // Get the token contract
    const contract = getContract({
      client,
      address: RCG_CONTRACT_ADDRESS,
      chain: baseSepolia,
    });
    
    // Check current total supply
    const totalSupplyBefore = await totalSupply({ contract });
    console.log('📊 Total Supply Before:', (totalSupplyBefore / 10n ** 18n).toString(), 'RCG');

    // Check target wallet balance before
    const balanceBefore = await balanceOf({ 
      contract, 
      address: TARGET_WALLET 
    });
    console.log('💰 Target Balance Before:', (balanceBefore / 10n ** 18n).toString(), 'RCG');

    // Prepare mint transaction
    console.log('\n⏳ Preparing mint transaction...');
    const transaction = mintTo({
      contract,
      to: TARGET_WALLET,
      amount: MINT_AMOUNT.toString(),
    });

    // Send transaction
    console.log('⏳ Sending transaction...');
    const result = await sendTransaction({
      transaction,
      account,
    });
    
    console.log('✅ Transaction submitted!');
    console.log('📜 Transaction Hash:', result.transactionHash);
    
    // Wait a moment for the transaction to be processed
    console.log('\n⏳ Waiting for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify the mint
    const balanceAfter = await balanceOf({ 
      contract, 
      address: TARGET_WALLET 
    });
    const totalSupplyAfter = await totalSupply({ contract });
    
    console.log('\n🎉 Minting Complete!');
    console.log('💎 New Balance:', (balanceAfter / 10n ** 18n).toString(), 'RCG');
    console.log('📊 Total Supply After:', (totalSupplyAfter / 10n ** 18n).toString(), 'RCG');
    console.log('🔗 View on BaseScan: https://sepolia.basescan.org/tx/' + result.transactionHash);
    
  } catch (error) {
    console.error('❌ Error minting tokens:', error);
    process.exit(1);
  }
}

// Run the minting
mintRCGTokens()
  .then(() => {
    console.log('\n✨ All done! You now have 100M RCG tokens in your wallet.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to mint tokens:', error);
    process.exit(1);
  });