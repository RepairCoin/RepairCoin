import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getRCGService } from '../services/RCGService';

async function checkRCGBalance(walletAddress: string) {
  try {
    const rcgService = getRCGService();
    const rcgReader = rcgService.getRCGTokenReader();
    
    console.log(`Checking RCG balance for wallet: ${walletAddress}`);
    
    const balance = await rcgReader.getBalance(walletAddress);
    const balanceNum = parseFloat(balance);
    
    console.log(`Raw balance string: ${balance}`);
    console.log(`Parsed balance: ${balanceNum}`);
    console.log(`Human readable: ${balanceNum.toLocaleString()} RCG`);
    
    // Check if it's the expected 10,004
    if (balanceNum > 10000 && balanceNum < 11000) {
      console.log(`✅ Balance is in the expected range (10,004 RCG)`);
    } else if (balanceNum > 1000000) {
      console.log(`⚠️ Balance seems very high - might be test tokens or incorrect decimals`);
    }
    
  } catch (error) {
    console.error('Error checking balance:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
const walletAddress = process.argv[2] || '0x761e5e59485ec6feb263320f5d636042bd9ebc8c';
checkRCGBalance(walletAddress);