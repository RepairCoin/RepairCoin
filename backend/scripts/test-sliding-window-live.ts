/**
 * Live Test: Sliding Window Token Refresh
 *
 * This script tests the actual sliding window refresh by:
 * 1. Getting a fresh token via login simulation
 * 2. Making API requests at intervals
 * 3. Checking for X-Token-Refreshed header
 *
 * Run: npx ts-node scripts/test-sliding-window-live.ts
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET!;

// Test settings
const TOKEN_EXPIRY_SECONDS = 2 * 60; // 2 minutes (must match auth.ts)
const THRESHOLD_SECONDS = 1 * 60; // 1 minute (must match auth.ts)
const CHECK_INTERVAL_MS = 15 * 1000; // Check every 15 seconds

interface TestResult {
  timestamp: string;
  elapsed: string;
  status: number;
  tokenRefreshed: boolean;
  tokenTimeRemaining?: number;
  message: string;
}

const results: TestResult[] = [];
let testStartTime: number;
let authToken: string;

// Generate a test token manually (simulating login)
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

function getTokenTimeRemaining(token: string): number {
  try {
    const decoded = jwt.decode(token) as { exp: number };
    if (decoded && decoded.exp) {
      return decoded.exp - Math.floor(Date.now() / 1000);
    }
  } catch (e) {
    // ignore
  }
  return -1;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function makeTestRequest(): Promise<TestResult> {
  const elapsed = Date.now() - testStartTime;
  const timestamp = new Date().toLocaleTimeString();
  const tokenRemaining = getTokenTimeRemaining(authToken);

  try {
    const response = await axios.get(`${API_URL}/auth/session`, {
      headers: {
        Cookie: `auth_token=${authToken}`
      },
      validateStatus: () => true // Don't throw on any status
    });

    const tokenRefreshed = response.headers['x-token-refreshed'] === 'true';

    // If we got a new token in response, update our stored token
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const match = setCookie.toString().match(/auth_token=([^;]+)/);
      if (match) {
        authToken = match[1];
        console.log('  📝 New token received via Set-Cookie');
      }
    }

    return {
      timestamp,
      elapsed: formatElapsed(elapsed),
      status: response.status,
      tokenRefreshed,
      tokenTimeRemaining: tokenRemaining,
      message: tokenRefreshed
        ? '🔄 SLIDING WINDOW TRIGGERED!'
        : response.status === 200
          ? '✅ OK'
          : `❌ Error ${response.status}`
    };
  } catch (error: any) {
    return {
      timestamp,
      elapsed: formatElapsed(elapsed),
      status: error.response?.status || 0,
      tokenRefreshed: false,
      tokenTimeRemaining: tokenRemaining,
      message: `❌ Request failed: ${error.message}`
    };
  }
}

async function runTest() {
  console.log('='.repeat(70));
  console.log('SLIDING WINDOW TOKEN REFRESH - LIVE TEST');
  console.log('='.repeat(70));
  console.log(`\nSettings:`);
  console.log(`  Token expiry: ${TOKEN_EXPIRY_SECONDS} seconds (${TOKEN_EXPIRY_SECONDS / 60} minutes)`);
  console.log(`  Sliding window threshold: ${THRESHOLD_SECONDS} seconds (${THRESHOLD_SECONDS / 60} minute)`);
  console.log(`  Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
  console.log(`\nExpected behavior:`);
  console.log(`  - Requests at 0:00 - 1:00: Normal responses, no refresh`);
  console.log(`  - Requests at 1:00 - 2:00: Should trigger sliding window (token < 1 min remaining)`);
  console.log(`  - Requests after 2:00: If no refresh happened, should get 401`);
  console.log('\n' + '='.repeat(70));

  // Generate initial token
  console.log('\n🔑 Generating test token...');
  authToken = generateTestToken(TOKEN_EXPIRY_SECONDS);
  const initialRemaining = getTokenTimeRemaining(authToken);
  console.log(`  Token created with ${initialRemaining} seconds until expiry`);

  testStartTime = Date.now();

  console.log('\n📊 Starting test requests...\n');
  console.log('Time     | Elapsed | Status | Token TTL | Refreshed | Message');
  console.log('-'.repeat(70));

  // Make requests every CHECK_INTERVAL_MS for 3 minutes
  const totalDuration = 3 * 60 * 1000; // 3 minutes
  const numChecks = Math.ceil(totalDuration / CHECK_INTERVAL_MS);

  for (let i = 0; i <= numChecks; i++) {
    const result = await makeTestRequest();
    results.push(result);

    const ttl = result.tokenTimeRemaining !== undefined
      ? `${result.tokenTimeRemaining}s`.padEnd(9)
      : 'N/A'.padEnd(9);

    console.log(
      `${result.timestamp} | ${result.elapsed.padEnd(7)} | ${result.status.toString().padEnd(6)} | ${ttl} | ${result.tokenRefreshed ? 'YES ✓' : 'No'.padEnd(5)}    | ${result.message}`
    );

    // Stop if we get a 401 (token expired without refresh)
    if (result.status === 401) {
      console.log('\n⚠️ Got 401 - token expired. Test complete.');
      break;
    }

    // Wait for next check (unless this is the last iteration)
    if (i < numChecks) {
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const slidingWindowTriggered = results.some(r => r.tokenRefreshed);
  const got401 = results.some(r => r.status === 401);

  if (slidingWindowTriggered) {
    console.log('\n✅ SUCCESS: Sliding window refresh was triggered!');
    const triggerResult = results.find(r => r.tokenRefreshed);
    if (triggerResult) {
      console.log(`   Triggered at: ${triggerResult.elapsed} (token had ${triggerResult.tokenTimeRemaining}s remaining)`);
    }
  } else if (got401) {
    console.log('\n❌ FAILED: Token expired without sliding window refresh');
    console.log('   Check that:');
    console.log('   1. Backend was restarted after code changes');
    console.log('   2. SLIDING_WINDOW_THRESHOLD_SECONDS is set correctly in auth.ts');
    console.log('   3. Token expiry matches ACCESS_TOKEN_EXPIRES_IN in auth.ts');
  } else {
    console.log('\n⚠️ INCONCLUSIVE: No sliding window triggered and no 401 received');
    console.log('   The test may not have run long enough, or settings are incorrect');
  }

  console.log('\n' + '='.repeat(70));
}

// Run the test
runTest().catch(console.error);
