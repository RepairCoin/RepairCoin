/**
 * Test script to call check-user endpoint directly
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testCheckUser() {
  console.log('\n=== TEST CHECK-USER ENDPOINT ===\n');

  const testAddress = '0xC04f08e45d3b61f5e7Df499914fd716Af9854021';
  const testEmail = 'anna.cagunot@gmail.com';

  console.log('Testing with:');
  console.log(`  Address: ${testAddress}`);
  console.log(`  Email: ${testEmail}`);
  console.log(`  API URL: ${API_URL}`);
  console.log('');

  try {
    // Test 1: With email
    console.log('1. Testing check-user WITH email...');
    const responseWithEmail = await fetch(`${API_URL}/api/auth/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: testAddress, email: testEmail })
    });

    const dataWithEmail = await responseWithEmail.json();
    console.log(`   Status: ${responseWithEmail.status}`);
    console.log(`   Response:`, JSON.stringify(dataWithEmail, null, 2));
    console.log('');

    // Test 2: Without email
    console.log('2. Testing check-user WITHOUT email...');
    const responseNoEmail = await fetch(`${API_URL}/api/auth/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: testAddress })
    });

    const dataNoEmail = await responseNoEmail.json();
    console.log(`   Status: ${responseNoEmail.status}`);
    console.log(`   Response:`, JSON.stringify(dataNoEmail, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testCheckUser();
