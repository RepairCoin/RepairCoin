/**
 * Transfer RCG from In-App Wallet
 *
 * This script transfers RCG tokens from a Thirdweb in-app wallet (social login)
 * to another wallet address.
 *
 * Usage: npx ts-node scripts/transfer-rcg-from-inapp-wallet.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
  toWei
} from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { inAppWallet, preAuthenticate, getUserEmail } from 'thirdweb/wallets/in-app';

// Configuration
const RCG_CONTRACT_ADDRESS = '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D';
const FROM_EMAIL = 'testdeo016@gmail.com';
const FROM_ADDRESS = '0x3d4841b6e2b1f49ef54ea7a794328582c6d5c14d';
const TO_ADDRESS = '0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function main() {
  console.log('='.repeat(60));
  console.log('RCG Transfer from In-App Wallet');
  console.log('='.repeat(60));
  console.log(`\nFrom: ${FROM_EMAIL} (${FROM_ADDRESS})`);
  console.log(`To: ${TO_ADDRESS}`);
  console.log('');

  // Create Thirdweb client
  const client = createThirdwebClient({
    clientId: process.env.THIRDWEB_CLIENT_ID!,
    secretKey: process.env.THIRDWEB_SECRET_KEY!,
  });

  // Get RCG contract
  const rcgContract = getContract({
    client,
    chain: baseSepolia,
    address: RCG_CONTRACT_ADDRESS,
  });

  // Check current balance
  console.log('Checking RCG balance...');
  const balance = await readContract({
    contract: rcgContract,
    method: 'function balanceOf(address account) view returns (uint256)',
    params: [FROM_ADDRESS],
  });

  const balanceInRCG = Number(balance) / 1e18;
  console.log(`Current RCG Balance: ${balanceInRCG.toLocaleString()} RCG`);

  if (balanceInRCG === 0) {
    console.log('\nNo RCG tokens to transfer. Exiting.');
    rl.close();
    process.exit(0);
  }

  // Confirm transfer
  console.log(`\nThis will transfer ALL ${balanceInRCG.toLocaleString()} RCG to ${TO_ADDRESS}`);
  const confirm = await question('\nProceed? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Transfer cancelled.');
    rl.close();
    process.exit(0);
  }

  // Create in-app wallet
  console.log('\n--- Authentication Required ---');
  console.log(`Sending verification code to ${FROM_EMAIL}...`);

  const wallet = inAppWallet();

  try {
    // Send OTP to email
    await preAuthenticate({
      client,
      strategy: 'email',
      email: FROM_EMAIL,
    });

    console.log(`\nVerification code sent to ${FROM_EMAIL}`);
    console.log('Please check your email and enter the code below.');

    const verificationCode = await question('\nEnter verification code: ');

    // Connect wallet with OTP
    console.log('\nVerifying and connecting wallet...');
    const account = await wallet.connect({
      client,
      chain: baseSepolia,
      strategy: 'email',
      email: FROM_EMAIL,
      verificationCode: verificationCode.trim(),
    });

    console.log(`\nWallet connected: ${account.address}`);

    // Verify address matches
    if (account.address.toLowerCase() !== FROM_ADDRESS.toLowerCase()) {
      console.log(`\nWARNING: Connected wallet address (${account.address}) differs from expected (${FROM_ADDRESS})`);
      const continueAnyway = await question('Continue anyway? (yes/no): ');
      if (continueAnyway.toLowerCase() !== 'yes') {
        console.log('Transfer cancelled.');
        rl.close();
        process.exit(0);
      }
    }

    // Prepare transfer transaction
    console.log('\nPreparing transfer transaction...');
    const transaction = prepareContractCall({
      contract: rcgContract,
      method: 'function transfer(address to, uint256 amount) returns (bool)',
      params: [TO_ADDRESS, balance], // Transfer full balance
    });

    // Send transaction
    console.log('Sending transaction...');
    const result = await sendTransaction({
      transaction,
      account,
    });

    console.log('\n' + '='.repeat(60));
    console.log('TRANSFER SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Amount: ${balanceInRCG.toLocaleString()} RCG`);
    console.log(`From: ${FROM_ADDRESS}`);
    console.log(`To: ${TO_ADDRESS}`);
    console.log(`\nView on BaseScan: https://sepolia.basescan.org/tx/${result.transactionHash}`);

  } catch (error: any) {
    console.error('\nError during transfer:', error.message || error);

    if (error.message?.includes('invalid verification code')) {
      console.log('\nThe verification code was incorrect. Please try again.');
    } else if (error.message?.includes('insufficient funds')) {
      console.log('\nInsufficient ETH for gas fees. Please add some ETH to the wallet.');
    }
  }

  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
