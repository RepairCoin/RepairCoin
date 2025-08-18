// Test script to verify wallet detection is working
import fetch from 'node-fetch';

class TestWalletDetectionService {
  constructor() {
    this.apiUrl = 'http://localhost:3000/api';
  }

  async detectWalletType(address) {
    console.log(`Testing wallet detection for: ${address}`);
    
    try {
      // Check if admin
      const adminAddresses = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c'.split(',');
      if (adminAddresses.some(admin => admin.toLowerCase() === address.toLowerCase())) {
        console.log('✅ Detected as ADMIN');
        return { type: 'admin', isRegistered: true, route: '/admin' };
      }

      // Check if customer
      console.log('Checking customer endpoint...');
      const customerResponse = await fetch(`${this.apiUrl}/customers/${address}`);
      console.log(`Customer API response status: ${customerResponse.status}`);
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log('✅ Detected as CUSTOMER');
        console.log('Customer data:', JSON.stringify(customerData.data.customer, null, 2));
        return { 
          type: 'customer', 
          isRegistered: true, 
          route: '/customer',
          data: customerData.data
        };
      }

      // Check if shop
      console.log('Checking shop endpoint...');
      const shopResponse = await fetch(`${this.apiUrl}/shops/wallet/${address}`);
      console.log(`Shop API response status: ${shopResponse.status}`);
      
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        console.log('✅ Detected as SHOP');
        console.log('Shop data:', JSON.stringify(shopData.data, null, 2));
        return { 
          type: 'shop', 
          isRegistered: true, 
          route: '/shop',
          data: shopData.data
        };
      }

      // Unknown wallet
      console.log('❌ Not registered anywhere');
      return { type: 'unknown', isRegistered: false, route: '/choose' };

    } catch (error) {
      console.error('❌ Error detecting wallet type:', error.message);
      return { type: 'unknown', isRegistered: false, route: '/choose' };
    }
  }
}

// Test cases
async function runTests() {
  const service = new TestWalletDetectionService();
  
  console.log('=== WALLET DETECTION TESTS ===\n');
  
  // Test 1: Admin address
  console.log('1. Testing Admin Address:');
  const adminResult = await service.detectWalletType('0x761E5E59485ec6feb263320f5d636042bD9EBc8c');
  console.log('Result:', adminResult);
  console.log();
  
  // Test 2: Registered customer
  console.log('2. Testing Registered Customer:');
  const customerResult = await service.detectWalletType('0x1234567890123456789012345678901234567890');
  console.log('Result:', customerResult);
  console.log();
  
  // Test 3: Unregistered address
  console.log('3. Testing Unregistered Address:');
  const unknownResult = await service.detectWalletType('0x9999999999999999999999999999999999999999');
  console.log('Result:', unknownResult);
  console.log();
  
  console.log('=== TESTS COMPLETE ===');
}

runTests().catch(console.error);