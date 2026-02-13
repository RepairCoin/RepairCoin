/**
 * Create Test Data for Automated No-Show Detection
 *
 * This script creates realistic test data to test the automated no-show detection system.
 * It creates:
 * - Test shops with auto-detection enabled
 * - Test customers
 * - Test services
 * - Backdated orders eligible for auto-detection
 *
 * Prerequisites:
 *   - Database must be running and accessible
 *   - Ensure your .env file has DATABASE_URL configured
 *   - For DigitalOcean: DATABASE_URL should include "sslmode=require"
 *
 * Usage:
 *   npx ts-node scripts/create-auto-detection-test-data.ts
 *
 * Created: February 13, 2026
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getSharedPool } from '../src/utils/database-pool';

const pool = getSharedPool();

interface TestShop {
  shopId: string;
  name: string;
  email: string;
  walletAddress: string;
}

interface TestCustomer {
  walletAddress: string;
  email: string;
  name: string;
}

interface TestService {
  serviceId: string;
  name: string;
  price: number;
}

interface TestOrder {
  orderId: string;
  bookingDate: string;
  bookingTime: string;
  scheduledFor: string;
}

const TEST_DATA = {
  shops: [
    {
      name: "AutoTest Repair Shop",
      email: "autotest@repaircoin.test",
      walletAddress: "0xautotest1111111111111111111111111111111",
    },
    {
      name: "QuickFix Auto Detection Test",
      email: "quickfix@repaircoin.test",
      walletAddress: "0xautotest2222222222222222222222222222222",
    }
  ],
  customers: [
    {
      name: "Test Customer Alpha",
      email: "customer.alpha@repaircoin.test",
      walletAddress: "0xcustomer1111111111111111111111111111111",
    },
    {
      name: "Test Customer Beta",
      email: "customer.beta@repaircoin.test",
      walletAddress: "0xcustomer2222222222222222222222222222222",
    }
  ]
};

async function checkIfTestDataExists(): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM shops WHERE email LIKE '%@repaircoin.test'`
  );
  return parseInt(result.rows[0].count) > 0;
}

async function cleanupExistingTestData(): Promise<void> {
  console.log('🧹 Cleaning up existing test data...');

  // Get test shop IDs
  const shopsResult = await pool.query(
    `SELECT shop_id FROM shops WHERE email LIKE '%@repaircoin.test'`
  );
  const shopIds = shopsResult.rows.map(row => row.shop_id);

  // Get test customer addresses
  const customersResult = await pool.query(
    `SELECT address FROM customers WHERE email LIKE '%@repaircoin.test'`
  );
  const customerAddresses = customersResult.rows.map(row => row.address);

  if (shopIds.length > 0) {
    // Delete orders
    await pool.query(
      `DELETE FROM service_orders WHERE shop_id = ANY($1)`,
      [shopIds]
    );

    // Delete services
    await pool.query(
      `DELETE FROM shop_services WHERE shop_id = ANY($1)`,
      [shopIds]
    );

    // Delete no-show policies
    await pool.query(
      `DELETE FROM shop_no_show_policy WHERE shop_id = ANY($1)`,
      [shopIds]
    );

    // Delete shops
    await pool.query(
      `DELETE FROM shops WHERE shop_id = ANY($1)`,
      [shopIds]
    );
  }

  if (customerAddresses.length > 0) {
    // Delete no-show history
    await pool.query(
      `DELETE FROM no_show_history WHERE customer_address = ANY($1)`,
      [customerAddresses]
    );

    // Delete customers (this will also clear no-show columns which are on the customers table)
    await pool.query(
      `DELETE FROM customers WHERE address = ANY($1)`,
      [customerAddresses]
    );
  }

  console.log(`   Deleted ${shopIds.length} test shops and related data`);
  console.log(`   Deleted ${customerAddresses.length} test customers and related data`);
}

async function createTestShops(): Promise<TestShop[]> {
  console.log('\n🏪 Creating test shops...');
  const shops: TestShop[] = [];

  for (const shopData of TEST_DATA.shops) {
    const result = await pool.query(
      `INSERT INTO shops (
        shop_id,
        wallet_address,
        name,
        email,
        phone,
        address,
        location_city,
        location_state,
        location_zip_code
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING shop_id, name, email, wallet_address`,
      [
        shopData.walletAddress,
        shopData.name,
        shopData.email,
        '555-TEST-0000',
        '123 Test Street',
        'Test City',
        'TC',
        '12345'
      ]
    );

    const shop = result.rows[0];
    shops.push({
      shopId: shop.shop_id,
      name: shop.name,
      email: shop.email,
      walletAddress: shop.wallet_address
    });

    // Create no-show policy with auto-detection enabled
    await pool.query(
      `INSERT INTO shop_no_show_policy (
        shop_id,
        enabled,
        auto_detection_enabled,
        grace_period_minutes,
        auto_detection_delay_hours,
        created_at
      ) VALUES ($1, true, true, 15, 2, NOW())
      ON CONFLICT (shop_id) DO UPDATE SET
        enabled = true,
        auto_detection_enabled = true,
        grace_period_minutes = 15,
        auto_detection_delay_hours = 2`,
      [shop.shop_id]
    );

    console.log(`   ✅ Created shop: ${shop.name} (ID: ${shop.shop_id})`);
    console.log(`      Auto-detection: enabled | Grace: 15min | Delay: 2hr`);
  }

  return shops;
}

async function createTestCustomers(): Promise<TestCustomer[]> {
  console.log('\n👤 Creating test customers...');
  const customers: TestCustomer[] = [];

  for (const customerData of TEST_DATA.customers) {
    const result = await pool.query(
      `INSERT INTO customers (
        address,
        wallet_address,
        email,
        name,
        phone,
        created_at
      ) VALUES (
        $1, $1, $2, $3, $4, NOW()
      ) RETURNING wallet_address, email, name`,
      [
        customerData.walletAddress,
        customerData.email,
        customerData.name,
        '555-CUST-0000'
      ]
    );

    const customer = result.rows[0];
    customers.push({
      walletAddress: customer.wallet_address,
      email: customer.email,
      name: customer.name
    });

    // No-show status columns are already initialized with defaults on the customers table

    console.log(`   ✅ Created customer: ${customer.name}`);
    console.log(`      Email: ${customer.email}`);
  }

  return customers;
}

async function createTestServices(shops: TestShop[]): Promise<Map<string, TestService[]>> {
  console.log('\n🔧 Creating test services...');
  const shopServices = new Map<string, TestService[]>();

  const serviceTemplates = [
    { name: 'Oil Change (Test)', price: 50.00 },
    { name: 'Brake Inspection (Test)', price: 75.00 },
    { name: 'Tire Rotation (Test)', price: 40.00 }
  ];

  for (const shop of shops) {
    const services: TestService[] = [];

    for (const template of serviceTemplates) {
      const result = await pool.query(
        `INSERT INTO shop_services (
          shop_id,
          service_name,
          description,
          price_usd,
          duration_minutes,
          active,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, true, NOW()
        ) RETURNING service_id, service_name, price_usd`,
        [
          shop.shopId,
          template.name,
          'Test service for auto-detection',
          template.price,
          60
        ]
      );

      const service = result.rows[0];
      services.push({
        serviceId: service.service_id,
        name: service.service_name,
        price: parseFloat(service.price_usd)
      });
    }

    shopServices.set(shop.shopId, services);
    console.log(`   ✅ Created ${services.length} services for ${shop.name}`);
  }

  return shopServices;
}

async function createBackdatedOrders(
  shops: TestShop[],
  customers: TestCustomer[],
  shopServices: Map<string, TestService[]>
): Promise<TestOrder[]> {
  console.log('\n📅 Creating backdated test orders (eligible for auto-detection)...');
  const orders: TestOrder[] = [];

  // Create orders at different time intervals for testing
  const testScenarios = [
    {
      description: 'Eligible immediately (5 hours ago)',
      hoursAgo: 5,
      minutesOffset: 0
    },
    {
      description: 'Eligible immediately (1 day ago)',
      hoursAgo: 24,
      minutesOffset: 0
    },
    {
      description: 'Just became eligible (2h 16min ago)',
      hoursAgo: 2,
      minutesOffset: 16
    },
    {
      description: 'Not eligible yet (1h 50min ago)',
      hoursAgo: 1,
      minutesOffset: 50
    }
  ];

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    const shop = shops[i % shops.length];
    const customer = customers[i % customers.length];
    const services = shopServices.get(shop.shopId)!;
    const service = services[i % services.length];

    // Calculate booking date and time
    const now = new Date();
    const totalMinutesAgo = (scenario.hoursAgo * 60) + scenario.minutesOffset;
    const appointmentTime = new Date(now.getTime() - (totalMinutesAgo * 60 * 1000));

    const bookingDate = appointmentTime.toISOString().split('T')[0];
    const bookingTime = appointmentTime.toTimeString().split(' ')[0].substring(0, 5) + ':00';

    // Determine eligibility
    // Grace period: 15 minutes, Detection delay: 2 hours
    // Total: 2 hours 15 minutes after appointment
    const isEligible = totalMinutesAgo >= 135; // 2h 15min = 135 minutes

    const result = await pool.query(
      `INSERT INTO service_orders (
        order_id,
        customer_address,
        shop_id,
        service_id,
        status,
        total_amount,
        booking_date,
        booking_time_slot,
        no_show,
        completed_at,
        created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'paid', $4, $5, $6, false, NULL, NOW() - INTERVAL '${totalMinutesAgo} minutes'
      ) RETURNING order_id, booking_date, booking_time_slot`,
      [
        customer.walletAddress,
        shop.shopId,
        service.serviceId,
        service.price,
        bookingDate,
        bookingTime
      ]
    );

    const order = result.rows[0];
    orders.push({
      orderId: order.order_id,
      bookingDate: order.booking_date,
      bookingTime: order.booking_time_slot,
      scheduledFor: `${bookingDate} ${bookingTime}`
    });

    console.log(`   ${isEligible ? '✅' : '⏳'} ${scenario.description}`);
    console.log(`      Order ID: ${order.order_id.substring(0, 8)}...`);
    console.log(`      Shop: ${shop.name}`);
    console.log(`      Customer: ${customer.name}`);
    console.log(`      Service: ${service.name} ($${service.price})`);
    console.log(`      Scheduled: ${bookingDate} at ${bookingTime}`);
    console.log(`      Eligible: ${isEligible ? 'YES - will be detected' : 'NO - needs more time'}`);
    console.log('');
  }

  return orders;
}

async function displaySummary(
  shops: TestShop[],
  customers: TestCustomer[],
  orders: TestOrder[]
): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST DATA CREATION SUMMARY');
  console.log('='.repeat(70));

  console.log(`\n✅ Created ${shops.length} test shops with auto-detection enabled`);
  console.log(`✅ Created ${customers.length} test customers (Tier 0 - Normal)`);
  console.log(`✅ Created ${orders.length} backdated orders for testing`);

  // Query to check eligibility
  const eligibleResult = await pool.query(`
    SELECT COUNT(*) as eligible_count
    FROM service_orders so
    LEFT JOIN shop_no_show_policy nsp ON nsp.shop_id = so.shop_id
    WHERE so.status IN ('paid', 'confirmed')
      AND so.booking_date IS NOT NULL
      AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
      AND COALESCE(so.no_show, false) IS NOT TRUE
      AND so.completed_at IS NULL
      AND COALESCE(nsp.enabled, true) IS TRUE
      AND COALESCE(nsp.auto_detection_enabled, true) IS TRUE
      AND (
        (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time +
         (COALESCE(nsp.grace_period_minutes, 15) || ' minutes')::interval +
         (COALESCE(nsp.auto_detection_delay_hours, 2) || ' hours')::interval
        ) < NOW()
      )
      AND so.customer_address LIKE '0xcustomer%'
  `);

  const eligibleCount = parseInt(eligibleResult.rows[0].eligible_count);

  console.log(`\n🎯 ${eligibleCount} orders are currently eligible for auto-detection`);

  console.log('\n' + '='.repeat(70));
  console.log('🧪 HOW TO TEST');
  console.log('='.repeat(70));

  console.log('\n1️⃣  Manual Trigger (Recommended):');
  console.log('   curl -X POST http://localhost:4000/api/services/test/auto-no-show-detection \\');
  console.log('     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \\');
  console.log('     -H "Content-Type: application/json"');

  console.log('\n2️⃣  Wait for automatic detection (runs every 30 minutes)');

  console.log('\n3️⃣  Verify detection worked:');
  console.log('   Check that eligible orders now have no_show = true');
  console.log('   Check notifications were sent to customers and shops');
  console.log('   Check no_show_history table has SYSTEM as marked_by');

  console.log('\n' + '='.repeat(70));
  console.log('📋 VERIFICATION QUERIES');
  console.log('='.repeat(70));

  console.log('\n-- Check which orders were marked as no-show:');
  console.log(`SELECT order_id, customer_address, booking_date, booking_time_slot,
       no_show, marked_no_show_at, no_show_notes
FROM service_orders
WHERE customer_address LIKE '0xcustomer%'
ORDER BY marked_no_show_at DESC;`);

  console.log('\n-- Check no-show history (should show SYSTEM as marker):');
  console.log(`SELECT customer_address, order_id, marked_by, marked_no_show_at, notes
FROM no_show_history
WHERE customer_address LIKE '0xcustomer%'
ORDER BY created_at DESC;`);

  console.log('\n-- Check customer tier updates:');
  console.log(`SELECT wallet_address, no_show_count, no_show_tier, last_no_show_at
FROM customers
WHERE wallet_address LIKE '0xcustomer%';`);

  console.log('\n-- Check notifications sent:');
  console.log(`SELECT receiver_address, notification_type, message, created_at
FROM notifications
WHERE receiver_address LIKE '0x%'
  AND notification_type IN ('service_no_show', 'shop_no_show_auto_detected')
ORDER BY created_at DESC
LIMIT 10;`);

  console.log('\n' + '='.repeat(70));
  console.log('🧹 CLEANUP');
  console.log('='.repeat(70));
  console.log('\nTo remove all test data, run this script again.');
  console.log('It will automatically detect and clean up existing test data.\n');
}

async function main() {
  console.log('🚀 Starting Auto No-Show Detection Test Data Creation...\n');

  try {
    // Check if test data already exists
    const hasExistingData = await checkIfTestDataExists();
    if (hasExistingData) {
      await cleanupExistingTestData();
    }

    // Create test data
    const shops = await createTestShops();
    const customers = await createTestCustomers();
    const shopServices = await createTestServices(shops);
    const orders = await createBackdatedOrders(shops, customers, shopServices);

    // Display summary
    await displaySummary(shops, customers, orders);

    console.log('✨ Test data creation completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating test data:', error);
    process.exit(1);
  }
}

// Run the script
main();
