import * as dotenv from 'dotenv';
import * as path from 'path';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testShopEndpoint(walletAddress: string) {
  try {
    const apiUrl = `http://localhost:${process.env.PORT || 4000}/api/shops/wallet/${walletAddress}`;
    console.log(`Testing endpoint: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    const data = await response.json() as any;
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\nKey fields:');
      console.log('- Shop ID:', data.data.shopId);
      console.log('- RCG Balance:', data.data.rcg_balance);
      console.log('- RCG Tier:', data.data.rcg_tier);
      console.log('- Operational Status:', data.data.operational_status);
    }
  } catch (error) {
    console.error('Error testing endpoint:', error);
  }
}

// Test shop001's wallet
testShopEndpoint('0x761e5e59485ec6feb263320f5d636042bd9ebc8c');