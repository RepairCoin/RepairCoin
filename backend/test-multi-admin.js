// Test script to verify multi-admin authentication
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:4000/api';

// Example admin addresses (replace with actual addresses from your .env)
const testAddresses = [
  '0xAdmin1AddressHere',  // First super admin
  '0xAdmin2AddressHere',  // Second super admin
  '0xNonAdminAddress'     // Non-admin for testing
];

async function testAdminAuth(address) {
  console.log(`\nTesting address: ${address}`);
  console.log('='.repeat(50));
  
  try {
    // Test /auth/check-user endpoint
    const checkResponse = await fetch(`${API_URL}/auth/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    const checkData = await checkResponse.json();
    
    if (checkResponse.ok && checkData.exists && checkData.type === 'admin') {
      console.log('✅ Admin recognized');
      console.log(`   Name: ${checkData.user.name}`);
      console.log(`   Role: ${checkData.user.role}`);
      console.log(`   Is Super Admin: ${checkData.user.isSuperAdmin}`);
      console.log(`   Permissions: ${JSON.stringify(checkData.user.permissions)}`);
      
      // Test /auth/admin endpoint for token generation
      const tokenResponse = await fetch(`${API_URL}/auth/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenResponse.ok && tokenData.success) {
        console.log('✅ Token generated successfully');
        console.log(`   Token: ${tokenData.token.substring(0, 20)}...`);
      } else {
        console.log('❌ Token generation failed:', tokenData.error);
      }
      
    } else if (!checkResponse.ok) {
      console.log('❌ Error checking user:', checkData.error || checkData.message);
    } else {
      console.log('❌ Not recognized as admin');
      console.log(`   User type: ${checkData.type || 'Not found'}`);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function main() {
  console.log('Multi-Admin Authentication Test');
  console.log('================================\n');
  
  // Get admin addresses from environment
  const envAdmins = (process.env.ADMIN_ADDRESSES || '').split(',').map(a => a.trim()).filter(a => a);
  
  if (envAdmins.length > 0) {
    console.log('Testing addresses from ADMIN_ADDRESSES environment variable:');
    console.log(`Found ${envAdmins.length} admin address(es)\n`);
    
    for (const address of envAdmins) {
      await testAdminAuth(address);
    }
  } else {
    console.log('⚠️  No ADMIN_ADDRESSES found in environment');
    console.log('Set ADMIN_ADDRESSES environment variable with comma-separated admin addresses');
    console.log('Example: ADMIN_ADDRESSES="0xAdmin1,0xAdmin2" node test-multi-admin.js');
  }
  
  // Test a non-admin address
  console.log('\nTesting non-admin address:');
  await testAdminAuth('0x1234567890123456789012345678901234567890');
  
  console.log('\n✅ Test completed');
}

// Run the test
main().catch(console.error);