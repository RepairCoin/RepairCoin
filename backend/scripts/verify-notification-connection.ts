/**
 * Quick verification script for notification preferences backend connection
 * Usage: npx ts-node scripts/verify-notification-connection.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api';

async function verifyConnection() {
  console.log('\n🔍 Verifying Notification Preferences Backend Connection...\n');

  const results = {
    serverRunning: false,
    domainRegistered: false,
    getEndpoint: false,
    putEndpoint: false,
    postEndpoint: false,
  };

  try {
    // 1. Check if server is running
    console.log('1️⃣ Checking if backend server is running...');
    try {
      const healthCheck = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
      results.serverRunning = true;
      console.log('   ✅ Backend server is running');
    } catch (error: any) {
      if (error.response) {
        results.serverRunning = true;
        console.log('   ✅ Backend server is running (received response)');
      } else {
        console.log('   ❌ Backend server is NOT running');
        return results;
      }
    }

    // 2. Check if notification domain is registered
    console.log('\n2️⃣ Checking if notification domain is registered...');
    try {
      const systemInfo = await axios.get(`${BASE_URL.replace('/api', '')}/api/system/info`);
      if (systemInfo.data?.data?.domains?.includes('notifications')) {
        results.domainRegistered = true;
        console.log('   ✅ Notification domain is registered');
        console.log('   Registered domains:', systemInfo.data.data.domains.join(', '));
      } else {
        console.log('   ❌ Notification domain is NOT registered');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check domain registration');
    }

    // 3. Test GET endpoint
    console.log('\n3️⃣ Testing GET /api/notifications/preferences/general...');
    try {
      const response = await axios.get(`${BASE_URL}/notifications/preferences/general`);
      console.log('   ❌ Unexpected success (should require auth)');
    } catch (error: any) {
      if (error.response?.data?.code === 'MISSING_AUTH_TOKEN') {
        results.getEndpoint = true;
        console.log('   ✅ GET endpoint exists and requires authentication');
      } else {
        console.log('   ❌ GET endpoint error:', error.message);
      }
    }

    // 4. Test PUT endpoint
    console.log('\n4️⃣ Testing PUT /api/notifications/preferences/general...');
    try {
      const response = await axios.put(`${BASE_URL}/notifications/preferences/general`, {
        platformUpdates: false
      });
      console.log('   ❌ Unexpected success (should require auth)');
    } catch (error: any) {
      if (error.response?.data?.code === 'MISSING_AUTH_TOKEN') {
        results.putEndpoint = true;
        console.log('   ✅ PUT endpoint exists and requires authentication');
      } else {
        console.log('   ❌ PUT endpoint error:', error.message);
      }
    }

    // 5. Test POST reset endpoint
    console.log('\n5️⃣ Testing POST /api/notifications/preferences/general/reset...');
    try {
      const response = await axios.post(`${BASE_URL}/notifications/preferences/general/reset`);
      console.log('   ❌ Unexpected success (should require auth)');
    } catch (error: any) {
      if (error.response?.data?.code === 'MISSING_AUTH_TOKEN') {
        results.postEndpoint = true;
        console.log('   ✅ POST endpoint exists and requires authentication');
      } else {
        console.log('   ❌ POST endpoint error:', error.message);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Server Running:        ${results.serverRunning ? '✅' : '❌'}`);
  console.log(`Domain Registered:     ${results.domainRegistered ? '✅' : '❌'}`);
  console.log(`GET Endpoint:          ${results.getEndpoint ? '✅' : '❌'}`);
  console.log(`PUT Endpoint:          ${results.putEndpoint ? '✅' : '❌'}`);
  console.log(`POST Reset Endpoint:   ${results.postEndpoint ? '✅' : '❌'}`);
  console.log('='.repeat(60));

  const allPassed = Object.values(results).every(v => v === true);

  if (allPassed) {
    console.log('\n✅ ALL CHECKS PASSED - Backend is fully connected!\n');
  } else {
    console.log('\n⚠️  SOME CHECKS FAILED - See details above\n');
  }

  return results;
}

// Run verification
verifyConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
