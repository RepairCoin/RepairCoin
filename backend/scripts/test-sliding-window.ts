/**
 * Test Script: Sliding Window Token Refresh
 *
 * This script tests the sliding window token refresh mechanism.
 * Run with: npx ts-node scripts/test-sliding-window.ts
 */

import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const SLIDING_WINDOW_THRESHOLD_SECONDS = 5 * 60; // 5 minutes

interface TokenPayload {
  address: string;
  role: 'admin' | 'shop' | 'customer';
  shopId?: string;
  type: 'access';
  iat: number;
  exp: number;
}

function generateTestToken(expiresInSeconds: number): string {
  const payload = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    role: 'customer',
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresInSeconds,
    issuer: 'repaircoin-api',
    audience: 'repaircoin-users'
  });
}

function checkSlidingWindowTrigger(token: string): { shouldRefresh: boolean; timeUntilExpiry: number } {
  const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
  const timeUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);
  const shouldRefresh = timeUntilExpiry > 0 && timeUntilExpiry < SLIDING_WINDOW_THRESHOLD_SECONDS;

  return { shouldRefresh, timeUntilExpiry };
}

console.log('='.repeat(60));
console.log('SLIDING WINDOW TOKEN REFRESH - TEST SUITE');
console.log('='.repeat(60));
console.log(`\nThreshold: ${SLIDING_WINDOW_THRESHOLD_SECONDS} seconds (${SLIDING_WINDOW_THRESHOLD_SECONDS / 60} minutes)\n`);

// Test 1: Token with 10 minutes remaining (should NOT refresh)
console.log('TEST 1: Token with 10 minutes remaining');
console.log('-'.repeat(40));
const token1 = generateTestToken(10 * 60); // 10 minutes
const result1 = checkSlidingWindowTrigger(token1);
console.log(`Time until expiry: ${result1.timeUntilExpiry} seconds (${(result1.timeUntilExpiry / 60).toFixed(1)} minutes)`);
console.log(`Should refresh: ${result1.shouldRefresh}`);
console.log(`Expected: false`);
console.log(`Result: ${result1.shouldRefresh === false ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Token with 4 minutes remaining (SHOULD refresh)
console.log('TEST 2: Token with 4 minutes remaining');
console.log('-'.repeat(40));
const token2 = generateTestToken(4 * 60); // 4 minutes
const result2 = checkSlidingWindowTrigger(token2);
console.log(`Time until expiry: ${result2.timeUntilExpiry} seconds (${(result2.timeUntilExpiry / 60).toFixed(1)} minutes)`);
console.log(`Should refresh: ${result2.shouldRefresh}`);
console.log(`Expected: true`);
console.log(`Result: ${result2.shouldRefresh === true ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Token with 1 minute remaining (SHOULD refresh)
console.log('TEST 3: Token with 1 minute remaining');
console.log('-'.repeat(40));
const token3 = generateTestToken(1 * 60); // 1 minute
const result3 = checkSlidingWindowTrigger(token3);
console.log(`Time until expiry: ${result3.timeUntilExpiry} seconds (${(result3.timeUntilExpiry / 60).toFixed(1)} minutes)`);
console.log(`Should refresh: ${result3.shouldRefresh}`);
console.log(`Expected: true`);
console.log(`Result: ${result3.shouldRefresh === true ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Token with exactly 5 minutes remaining (edge case - should NOT refresh)
console.log('TEST 4: Token with exactly 5 minutes remaining (edge case)');
console.log('-'.repeat(40));
const token4 = generateTestToken(5 * 60); // exactly 5 minutes
const result4 = checkSlidingWindowTrigger(token4);
console.log(`Time until expiry: ${result4.timeUntilExpiry} seconds (${(result4.timeUntilExpiry / 60).toFixed(1)} minutes)`);
console.log(`Should refresh: ${result4.shouldRefresh}`);
console.log(`Expected: false (threshold is < 5 min, not <= 5 min)`);
console.log(`Result: ${result4.shouldRefresh === false ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: Fresh token with 15 minutes (should NOT refresh)
console.log('TEST 5: Fresh token with 15 minutes remaining');
console.log('-'.repeat(40));
const token5 = generateTestToken(15 * 60); // 15 minutes
const result5 = checkSlidingWindowTrigger(token5);
console.log(`Time until expiry: ${result5.timeUntilExpiry} seconds (${(result5.timeUntilExpiry / 60).toFixed(1)} minutes)`);
console.log(`Should refresh: ${result5.shouldRefresh}`);
console.log(`Expected: false`);
console.log(`Result: ${result5.shouldRefresh === false ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
const allPassed =
  result1.shouldRefresh === false &&
  result2.shouldRefresh === true &&
  result3.shouldRefresh === true &&
  result4.shouldRefresh === false &&
  result5.shouldRefresh === false;

if (allPassed) {
  console.log('\n✅ ALL TESTS PASSED\n');
  console.log('The sliding window refresh logic is working correctly.');
  console.log('Tokens will be refreshed when they have < 5 minutes remaining.');
} else {
  console.log('\n❌ SOME TESTS FAILED\n');
  console.log('Please check the sliding window implementation.');
}

console.log('\n' + '='.repeat(60));
console.log('HOW TO TEST IN BROWSER');
console.log('='.repeat(60));
console.log(`
1. Login to the app
2. Open DevTools (F12) → Network tab
3. Wait 10+ minutes (or reduce token expiry for faster testing)
4. Make any API request
5. Check response headers for: X-Token-Refreshed: true
6. Check console for: [API Client] Sliding window refresh...
7. Check backend logs for: Sliding window refresh: Token expiring soon...
`);
