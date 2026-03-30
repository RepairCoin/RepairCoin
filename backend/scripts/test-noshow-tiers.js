/**
 * Comprehensive No-Show Tier & Restriction Live Tester
 * Run: node scripts/test-noshow-tiers.js
 *
 * Tests all tier restrictions against the actual running backend.
 */
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3002;
const CUSTOMER = '0x6cd036477d1c39da021095a62a32c6bb919993cf';
const SHOP_ID = 'peanut';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '25060'),
  database: process.env.DB_NAME || 'defaultdb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

function makeRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${token}`,
        ...(body ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(bodyStr);
    req.end();
  });
}

async function setCustomerTier(count, tier) {
  await pool.query(
    "UPDATE customers SET no_show_count = $1, no_show_tier = $2, deposit_required = $3, booking_suspended_until = $4 WHERE LOWER(address) = $5",
    [count, tier, tier === 'deposit_required', tier === 'suspended' ? new Date(Date.now() + 30*24*60*60*1000) : null, CUSTOMER]
  );
}

async function run() {
  const custToken = jwt.sign(
    { address: CUSTOMER, role: 'customer', type: 'access' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );

  // Get a service to test booking with
  const svcResult = await pool.query("SELECT service_id, price_usd FROM shop_services WHERE shop_id = $1 LIMIT 1", [SHOP_ID]);
  if (svcResult.rows.length === 0) { console.log('ERROR: No active services for shop'); await pool.end(); return; }
  const serviceId = svcResult.rows[0].service_id;

  // Save original state
  const origResult = await pool.query("SELECT no_show_count, no_show_tier, deposit_required, booking_suspended_until FROM customers WHERE LOWER(address) = $1", [CUSTOMER]);
  const original = origResult.rows[0];

  console.log('\n========================================');
  console.log('  NO-SHOW TIER RESTRICTION LIVE TESTS');
  console.log('========================================');
  console.log(`Customer: ${CUSTOMER}`);
  console.log(`Shop: ${SHOP_ID}, Service: ${serviceId}`);
  console.log(`Original: count=${original.no_show_count}, tier=${original.no_show_tier}\n`);

  // Future booking date (3 days from now)
  const futureDate = new Date(Date.now() + 3*24*60*60*1000);
  const bookingDate = futureDate.toISOString().split('T')[0];

  // Near booking (2 hours from now - should fail for 24h/48h restrictions)
  const nearDate = new Date(Date.now() + 2*60*60*1000);
  const nearBookingDate = nearDate.toISOString().split('T')[0];
  const nearBookingTime = `${String(nearDate.getHours()).padStart(2,'0')}:00`;

  const tests = [];

  // ========================================
  // TEST 1: Normal tier - no restrictions
  // ========================================
  console.log('--- Test 1: NORMAL tier (count=0) ---');
  await setCustomerTier(0, 'normal');
  let r = await makeRequest('GET', `/api/customers/${CUSTOMER}/overall-no-show-status`, custToken);
  tests.push({
    name: 'Normal tier - status',
    pass: r.data?.data?.tier === 'normal' && r.data?.data?.canBook === true && r.data?.data?.restrictions?.length === 0,
    detail: `tier=${r.data?.data?.tier}, canBook=${r.data?.data?.canBook}, restrictions=${JSON.stringify(r.data?.data?.restrictions)}`
  });

  // ========================================
  // TEST 2: Warning tier (count=1)
  // ========================================
  console.log('--- Test 2: WARNING tier (count=1) ---');
  await setCustomerTier(1, 'warning');
  r = await makeRequest('GET', `/api/customers/${CUSTOMER}/overall-no-show-status`, custToken);
  tests.push({
    name: 'Warning tier - banner shows',
    pass: r.data?.data?.tier === 'warning' && r.data?.data?.canBook === true,
    detail: `tier=${r.data?.data?.tier}, canBook=${r.data?.data?.canBook}`
  });

  // ========================================
  // TEST 3: Caution tier - 24h advance booking
  // ========================================
  console.log('--- Test 3: CAUTION tier (count=2) ---');
  await setCustomerTier(2, 'caution');
  r = await makeRequest('GET', `/api/customers/${CUSTOMER}/overall-no-show-status`, custToken);
  tests.push({
    name: 'Caution tier - restrictions',
    pass: r.data?.data?.tier === 'caution' && r.data?.data?.minimumAdvanceHours === 24,
    detail: `tier=${r.data?.data?.tier}, advanceHours=${r.data?.data?.minimumAdvanceHours}, restrictions=${JSON.stringify(r.data?.data?.restrictions)}`
  });

  // Test booking within 24h should FAIL
  r = await makeRequest('POST', '/api/services/orders/stripe-checkout', custToken, {
    serviceId, bookingDate: nearBookingDate, bookingTime: nearBookingTime
  });
  tests.push({
    name: 'Caution - booking <24h rejected',
    pass: r.status === 400 && (r.data?.error?.includes('advance notice') || r.data?.error?.includes('no-show')),
    detail: `status=${r.status}, error=${r.data?.error?.substring(0, 80)}`
  });

  // Test booking >24h should PASS (or at least not fail on advance hours)
  r = await makeRequest('POST', '/api/services/orders/stripe-checkout', custToken, {
    serviceId, bookingDate, bookingTime: '14:00'
  });
  tests.push({
    name: 'Caution - booking >24h allowed',
    pass: r.status === 201 || (r.status === 400 && !r.data?.error?.includes('advance notice')),
    detail: `status=${r.status}, error=${r.data?.error?.substring(0, 80) || 'none'}`
  });

  // ========================================
  // TEST 4: Deposit Required tier - 48h advance + deposit
  // ========================================
  console.log('--- Test 4: DEPOSIT_REQUIRED tier (count=3) ---');
  await setCustomerTier(3, 'deposit_required');
  r = await makeRequest('GET', `/api/customers/${CUSTOMER}/overall-no-show-status`, custToken);
  tests.push({
    name: 'Deposit tier - restrictions',
    pass: r.data?.data?.tier === 'deposit_required' && r.data?.data?.requiresDeposit === true && r.data?.data?.minimumAdvanceHours === 48,
    detail: `tier=${r.data?.data?.tier}, deposit=${r.data?.data?.requiresDeposit}, advanceHours=${r.data?.data?.minimumAdvanceHours}, restrictions=${JSON.stringify(r.data?.data?.restrictions)}`
  });

  // Test booking within 48h should FAIL
  r = await makeRequest('POST', '/api/services/orders/stripe-checkout', custToken, {
    serviceId, bookingDate: nearBookingDate, bookingTime: nearBookingTime
  });
  tests.push({
    name: 'Deposit - booking <48h rejected',
    pass: r.status === 400 && (r.data?.error?.includes('advance notice') || r.data?.error?.includes('no-show')),
    detail: `status=${r.status}, error=${r.data?.error?.substring(0, 80)}`
  });

  // ========================================
  // TEST 5: Suspended tier - cannot book at all
  // ========================================
  console.log('--- Test 5: SUSPENDED tier (count=5) ---');
  await setCustomerTier(5, 'suspended');
  r = await makeRequest('GET', `/api/customers/${CUSTOMER}/overall-no-show-status`, custToken);
  tests.push({
    name: 'Suspended tier - cannot book',
    pass: r.data?.data?.tier === 'suspended' && r.data?.data?.canBook === false,
    detail: `tier=${r.data?.data?.tier}, canBook=${r.data?.data?.canBook}, suspendedUntil=${r.data?.data?.bookingSuspendedUntil}`
  });

  // Test booking should FAIL with suspension message
  r = await makeRequest('POST', '/api/services/orders/stripe-checkout', custToken, {
    serviceId, bookingDate, bookingTime: '14:00'
  });
  tests.push({
    name: 'Suspended - booking rejected',
    pass: r.status === 400 && (r.data?.error?.includes('suspended') || r.data?.error?.includes('Suspended')),
    detail: `status=${r.status}, error=${r.data?.error?.substring(0, 80)}`
  });

  // ========================================
  // Restore original state
  // ========================================
  await pool.query(
    "UPDATE customers SET no_show_count = $1, no_show_tier = $2, deposit_required = $3, booking_suspended_until = $4 WHERE LOWER(address) = $5",
    [original.no_show_count, original.no_show_tier, original.deposit_required, original.booking_suspended_until, CUSTOMER]
  );

  // ========================================
  // RESULTS
  // ========================================
  console.log('\n========================================');
  console.log('  RESULTS');
  console.log('========================================\n');

  let passed = 0, failed = 0;
  for (const t of tests) {
    const icon = t.pass ? '✅' : '❌';
    console.log(`${icon} ${t.name}`);
    console.log(`   ${t.detail}`);
    if (t.pass) passed++; else failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);

  if (failed > 0) {
    console.log('\n⚠️  ISSUES FOUND - see failed tests above');
  } else {
    console.log('\n✅ All tier restrictions working correctly!');
  }

  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); pool.end(); });
