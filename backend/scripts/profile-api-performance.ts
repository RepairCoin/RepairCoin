/**
 * API Performance Profiler
 * Measures actual response times and identifies bottlenecks
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test customer address (replace with real one from your database)
let testCustomerAddress = '';

async function timeQuery(name: string, queryFn: () => Promise<any>): Promise<{ name: string; ms: number; result: any }> {
  const start = Date.now();
  const result = await queryFn();
  const ms = Date.now() - start;
  return { name, ms, result };
}

async function getTestCustomer(): Promise<string> {
  const result = await pool.query('SELECT address FROM customers LIMIT 1');
  return result.rows[0]?.address || '';
}

async function profileCustomerEndpoint(address: string) {
  console.log('\n📊 Profiling /customers/{address} endpoint queries (OPTIMIZED):\n');

  // After removing blockchain call, this endpoint only does 1 DB query
  const queries = [
    timeQuery('1. Get customer', () =>
      pool.query('SELECT * FROM customers WHERE address = $1', [address.toLowerCase()])
    ),
    // NOTE: Removed blockchain call (was taking 1-2s)
    // Frontend fetches blockchain balance directly via thirdweb
  ];

  const results = await Promise.all(queries);

  let total = 0;
  for (const r of results) {
    console.log(`  ${r.name}: ${r.ms}ms`);
    total += r.ms;
  }
  console.log(`  ─────────────────────────`);
  console.log(`  Total: ${total}ms\n`);

  return total;
}

async function profileBalanceEndpoint(address: string) {
  console.log('\n📊 Profiling /tokens/balance/{address} endpoint queries (OPTIMIZED):\n');

  const queries = [
    timeQuery('1. Get customer', () =>
      pool.query('SELECT * FROM customers WHERE address = $1', [address.toLowerCase()])
    ),
    timeQuery('2. Get transaction totals (SQL aggregation)', () =>
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redeemed,
          COALESCE(SUM(CASE WHEN type = 'mint' AND (
            metadata->>'mintType' = 'instant_mint' OR
            metadata->>'source' = 'customer_dashboard'
          ) THEN amount ELSE 0 END), 0) as total_minted_to_wallet
        FROM transactions
        WHERE customer_address = $1
      `, [address.toLowerCase()])
    ),
    // NOTE: Removed slow getCustomerRcnBySource call (was taking ~2s)
    // earningHistory breakdown is now returned as zeros
  ];

  const results = await Promise.all(queries);

  let total = 0;
  for (const r of results) {
    console.log(`  ${r.name}: ${r.ms}ms`);
    total += r.ms;
  }
  console.log(`  ─────────────────────────`);
  console.log(`  Total: ${total}ms\n`);

  return total;
}

async function profileTransactionsEndpoint(address: string) {
  console.log('\n📊 Profiling /customers/{address}/transactions endpoint queries:\n');

  const queries = [
    timeQuery('1. Get customer (auth check)', () =>
      pool.query('SELECT * FROM customers WHERE address = $1', [address.toLowerCase()])
    ),
    timeQuery('2. Get transactions with shop names', () =>
      pool.query(`
        SELECT t.*, s.name as shop_name
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        WHERE t.customer_address = $1
        ORDER BY t.timestamp DESC
        LIMIT 10
      `, [address.toLowerCase()])
    ),
  ];

  const results = await Promise.all(queries);

  let total = 0;
  for (const r of results) {
    console.log(`  ${r.name}: ${r.ms}ms`);
    total += r.ms;
  }
  console.log(`  ─────────────────────────`);
  console.log(`  Total: ${total}ms\n`);

  return total;
}

async function profileNotificationsEndpoint(address: string) {
  console.log('\n📊 Profiling /notifications endpoint queries:\n');

  const queries = [
    timeQuery('1. Count notifications', () =>
      pool.query('SELECT COUNT(*) FROM notifications WHERE receiver_address = $1', [address.toLowerCase()])
    ),
    timeQuery('2. Get notifications (paginated)', () =>
      pool.query(`
        SELECT * FROM notifications
        WHERE receiver_address = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [address.toLowerCase()])
    ),
    timeQuery('3. Get unread count', () =>
      pool.query(`
        SELECT COUNT(*) FROM notifications
        WHERE receiver_address = $1 AND is_read = false
      `, [address.toLowerCase()])
    ),
  ];

  const results = await Promise.all(queries);

  let total = 0;
  for (const r of results) {
    console.log(`  ${r.name}: ${r.ms}ms`);
    total += r.ms;
  }
  console.log(`  ─────────────────────────`);
  console.log(`  Total: ${total}ms\n`);

  return total;
}

async function profileGroupBalancesEndpoint(address: string) {
  console.log('\n📊 Profiling /affiliate-groups/customer/{address}/balances endpoint queries:\n');

  try {
    const queries = [
      timeQuery('1. Get customer group balances with group details', () =>
        pool.query(`
          SELECT
            cgb.*,
            asg.group_name,
            asg.custom_token_symbol,
            asg.custom_token_name,
            asg.icon,
            asg.description
          FROM customer_group_balances cgb
          JOIN affiliate_shop_groups asg ON cgb.group_id = asg.group_id
          WHERE cgb.customer_address = $1
        `, [address.toLowerCase()])
      ),
    ];

    const results = await Promise.all(queries);

    let total = 0;
    for (const r of results) {
      console.log(`  ${r.name}: ${r.ms}ms`);
      total += r.ms;
    }
    console.log(`  ─────────────────────────`);
    console.log(`  Total: ${total}ms\n`);

    return total;
  } catch (e) {
    console.log('  (table not found - skipping)\n');
    return 0;
  }
}

async function checkIndexes() {
  console.log('\n📊 Checking database indexes:\n');

  const result = await pool.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('customers', 'transactions', 'notifications', 'customer_group_balances')
    ORDER BY tablename, indexname
  `);

  const byTable: Record<string, string[]> = {};
  for (const row of result.rows) {
    if (!byTable[row.tablename]) byTable[row.tablename] = [];
    byTable[row.tablename].push(row.indexname);
  }

  for (const [table, indexes] of Object.entries(byTable)) {
    console.log(`  ${table}:`);
    for (const idx of indexes) {
      console.log(`    - ${idx}`);
    }
  }
}

async function checkTableSizes() {
  console.log('\n📊 Table row counts:\n');

  const tables = ['customers', 'transactions', 'notifications', 'shops'];

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0].count} rows`);
    } catch (e) {
      console.log(`  ${table}: (table not found)`);
    }
  }
}

async function main() {
  console.log('🔍 RepairCoin API Performance Profiler\n');
  console.log('=' .repeat(50));

  // Get a test customer
  testCustomerAddress = await getTestCustomer();
  if (!testCustomerAddress) {
    console.error('No customers found in database');
    process.exit(1);
  }
  console.log(`\nUsing test customer: ${testCustomerAddress}\n`);

  // Check table sizes
  await checkTableSizes();

  // Check indexes
  await checkIndexes();

  // Profile each endpoint
  const results: Record<string, number> = {};

  results['customers'] = await profileCustomerEndpoint(testCustomerAddress);
  results['balance'] = await profileBalanceEndpoint(testCustomerAddress);
  results['transactions'] = await profileTransactionsEndpoint(testCustomerAddress);
  results['notifications'] = await profileNotificationsEndpoint(testCustomerAddress);
  results['groupBalances'] = await profileGroupBalancesEndpoint(testCustomerAddress);

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📈 SUMMARY - Estimated API Response Times:\n');

  let grandTotal = 0;
  for (const [endpoint, ms] of Object.entries(results)) {
    const status = ms > 500 ? '🔴 SLOW' : ms > 200 ? '🟡 OK' : '🟢 FAST';
    console.log(`  ${status} /${endpoint}: ${ms}ms`);
    grandTotal += ms;
  }

  console.log(`\n  Total sequential time: ${grandTotal}ms`);
  console.log(`  With Promise.all: ~${Math.max(...Object.values(results))}ms (longest query)`);

  console.log('\n⚠️  Note: These are DATABASE query times only.');
  console.log('   Actual API times include:');
  console.log('   - Network latency between server and DB');
  console.log('   - Express middleware overhead');
  console.log('   - JSON serialization');
  console.log('   - Any blockchain calls (removed in latest PR)');

  await pool.end();
}

main().catch(console.error);
