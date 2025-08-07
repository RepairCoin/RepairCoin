import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:3000/api';
const SHOP_WALLET = '0x761e5e59485ec6feb263320f5d636042bd9ebc8c'; // shop001
const CUSTOMER_WALLET = '0x1234567890123456789012345678901234567890';
const SHOP_ID = 'shop001';

async function main() {
  try {
    console.log('Testing daily earnings reset logic...\n');
    
    // 1. Authenticate as shop
    console.log('1. Authenticating as shop...');
    const authResponse = await axios.post(`${API_URL}/auth/shop`, {
      address: SHOP_WALLET
    });
    const authToken = authResponse.data.token;
    console.log('✅ Shop authenticated\n');
    
    // 2. Get customer info
    console.log('2. Getting customer info...');
    try {
      const customerResponse = await axios.get(`${API_URL}/customers/${CUSTOMER_WALLET}`);
      const customer = customerResponse.data.data.customer; // Note: customer is nested
      
      console.log('Customer data:');
      console.log(`- Address: ${customer.address}`);
      console.log(`- Tier: ${customer.tier}`);
      console.log(`- Lifetime earnings: ${customer.lifetimeEarnings} RCN`);
      console.log(`- Daily earnings: ${customer.dailyEarnings} RCN`);
      console.log(`- Monthly earnings: ${customer.monthlyEarnings} RCN`);
      console.log(`- Last earned date: ${customer.lastEarnedDate}`);
      
      // Check if last earned date is not today
      const today = new Date().toISOString().split('T')[0];
      const lastEarnedDateOnly = customer.lastEarnedDate.split('T')[0];
      console.log(`\nDate comparison:`);
      console.log(`- Today: ${today}`);
      console.log(`- Last earned date: ${lastEarnedDateOnly}`);
      console.log(`- Should reset daily earnings: ${lastEarnedDateOnly !== today}`);
    } catch (error) {
      console.log('Customer not found, will be created during reward');
    }
    
    // 3. Attempt to issue reward
    console.log('\n3. Attempting to issue reward...');
    try {
      const rewardResponse = await axios.post(
        `${API_URL}/shops/${SHOP_ID}/issue-reward`,
        {
          customerAddress: CUSTOMER_WALLET,
          repairAmount: 100, // $100 repair = 25 RCN base reward
          skipTierBonus: false
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      console.log('✅ Reward issued successfully!');
      console.log(`- Base reward: ${rewardResponse.data.data.baseReward} RCN`);
      console.log(`- Tier bonus: ${rewardResponse.data.data.tierBonus} RCN`);
      console.log(`- Total reward: ${rewardResponse.data.data.totalReward} RCN`);
      console.log(`- Transaction hash: ${rewardResponse.data.data.txHash}`);
      
      // 4. Check customer info again
      console.log('\n4. Checking customer info after reward...');
      const updatedCustomerResponse = await axios.get(`${API_URL}/customers/${CUSTOMER_WALLET}`);
      const updatedCustomer = updatedCustomerResponse.data.data.customer;
      
      console.log('Updated customer data:');
      console.log(`- Daily earnings: ${updatedCustomer.dailyEarnings} RCN`);
      console.log(`- Monthly earnings: ${updatedCustomer.monthlyEarnings} RCN`);
      console.log(`- Last earned date: ${updatedCustomer.lastEarnedDate}`);
      
    } catch (error: any) {
      console.error('❌ Failed to issue reward:');
      if (error.response?.data) {
        console.error(`Error: ${error.response.data.error}`);
        if (error.response.data.data) {
          console.error('Error details:', JSON.stringify(error.response.data.data, null, 2));
        }
      } else {
        console.error(error.message);
      }
    }
    
  } catch (error: any) {
    console.error('Test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();