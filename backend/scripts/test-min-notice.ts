/**
 * Test script for BUG-023: Minimum Notice Validation
 *
 * This tests that the backend rejects bookings within the minimum notice window,
 * even if someone tries to bypass the UI and call the API directly.
 */

import axios from 'axios';

const API_URL = 'http://localhost:3002/api';

async function testMinimumNotice() {
  console.log('=== BUG-023: Testing Minimum Notice Validation ===\n');

  // Get current time
  const now = new Date();
  console.log(`Current time: ${now.toLocaleString()}`);

  // Calculate a time slot that's 1 hour from now (should be rejected with 2hr min notice)
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const invalidTime = `${String(oneHourFromNow.getHours()).padStart(2, '0')}:00`;

  // Calculate a time slot that's 3 hours from now (should be accepted with 2hr min notice)
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const validTime = `${String(threeHoursFromNow.getHours()).padStart(2, '0')}:00`;

  // Today's date
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  console.log(`\nTest date: ${today}`);
  console.log(`Invalid time (1hr from now): ${invalidTime} - Should be REJECTED`);
  console.log(`Valid time (3hrs from now): ${validTime} - Should be ACCEPTED (if shop is open)\n`);

  // Test 1: Try to get available slots (should filter out slots within min notice)
  console.log('--- Test 1: Get Available Time Slots ---');
  try {
    const slotsResponse = await axios.get(`${API_URL}/services/appointments/available-slots`, {
      params: {
        shopId: 'dc_shopu',
        serviceId: 'srv_9177bf2d-c1d3-4249-8716-c3d4cdd1a0f4',
        date: today
      }
    });

    const slots = slotsResponse.data.data;
    console.log(`Total slots returned: ${slots.length}`);

    // Check if invalid time is in the list
    const invalidSlotInList = slots.find((s: any) => s.time === invalidTime);
    const validSlotInList = slots.find((s: any) => s.time === validTime);

    console.log(`Slot ${invalidTime} in list: ${invalidSlotInList ? 'YES (potential issue)' : 'NO (correct - filtered out)'}`);
    console.log(`Slot ${validTime} in list: ${validSlotInList ? 'YES' : 'NO (shop might be closed)'}`);
  } catch (error: any) {
    console.log('Error getting slots:', error.response?.data || error.message);
  }

  // Test 2: Try to create payment intent with invalid time (should fail)
  console.log('\n--- Test 2: Create Payment Intent with Invalid Time ---');
  console.log(`Attempting to book ${today} at ${invalidTime}...`);

  try {
    const response = await axios.post(
      `${API_URL}/services/checkout`,
      {
        serviceId: 'srv_9177bf2d-c1d3-4249-8716-c3d4cdd1a0f4',
        bookingDate: today,
        bookingTime: invalidTime
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // Note: This would need a valid customer auth token in real scenario
        },
        withCredentials: true
      }
    );

    console.log('❌ UNEXPECTED: Payment intent created (should have been rejected)');
    console.log('Response:', response.data);
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;

    if (errorMessage.includes('advance notice') || errorMessage.includes('minimum')) {
      console.log('✅ CORRECT: Request rejected with minimum notice error');
      console.log(`   Error: "${errorMessage}"`);
    } else if (errorMessage.includes('authentication') || errorMessage.includes('Unauthorized')) {
      console.log('⚠️  Request rejected due to auth (expected without login)');
      console.log(`   Error: "${errorMessage}"`);
      console.log('   Note: The minimum notice validation happens AFTER auth check');
    } else {
      console.log('❓ Request rejected with different error:');
      console.log(`   Error: "${errorMessage}"`);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('\nTo fully test, you can:');
  console.log('1. Login as a customer in the browser');
  console.log('2. Open browser DevTools > Network tab');
  console.log('3. Try to book a service');
  console.log('4. Intercept the request and change bookingTime to a slot within 2 hours');
  console.log('5. Should see error: "Bookings require at least 2 hours advance notice"');
}

testMinimumNotice().catch(console.error);
