// docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/setup-marketing-fixtures.ts
//
// Seeds the database with synthetic customers + transactions so the
// three AI Marketing test scenarios have data to act on:
//
//   - Top spenders (5 customers, $50 → $1000 spend ladder)
//   - Lapsed (3 customers, last_visit 100 days ago)
//   - Active (2 customers, last_visit 5 days ago — also counts as
//     "all_customers" for the Black Friday flow)
//
// Synthetic markers (so cleanup.ts can target only QA-inserted rows):
//   - customer name starts with "QA-MKTG-"
//   - customer email is *@repaircoin.test (RFC 6761 .test TLD — never
//     resolvable, prevents any accidental real delivery if SendGrid
//     does attempt these addresses)
//   - transaction reason is "AIMK-QA-<timestamp>"
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/setup-marketing-fixtures.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../../../../backend/.env"),
});

const SHOP_ID = "peanut";
const QA_MARKER = `AIMK-QA-${Date.now()}`;

interface SyntheticCustomer {
  address: string;
  name: string;
  email: string;
  /** Lifetime redemption amount — drives top_spenders ordering. */
  totalSpentUsd: number;
  /** Number of distinct days customer transacted. */
  visitCount: number;
  /** How many days back the most recent transaction sits. */
  daysSinceLastVisit: number;
}

// Synthetic wallet addresses — all start with 0xdead so they're
// trivially identifiable as test data. Each address is 42 chars
// (0x + 40 hex) matching the production wallet format.
const FIXTURES: SyntheticCustomer[] = [
  // --- Top spenders (5, descending spend) ---
  {
    address: "0xdead000000000000000000000000000000000001",
    name: "QA-MKTG-Whale Alice",
    email: "qa-test-1@repaircoin.test",
    totalSpentUsd: 1000,
    visitCount: 8,
    daysSinceLastVisit: 7,
  },
  {
    address: "0xdead000000000000000000000000000000000002",
    name: "QA-MKTG-Regular Bob",
    email: "qa-test-2@repaircoin.test",
    totalSpentUsd: 500,
    visitCount: 6,
    daysSinceLastVisit: 12,
  },
  {
    address: "0xdead000000000000000000000000000000000003",
    name: "QA-MKTG-Steady Carol",
    email: "qa-test-3@repaircoin.test",
    totalSpentUsd: 250,
    visitCount: 4,
    daysSinceLastVisit: 18,
  },
  {
    address: "0xdead000000000000000000000000000000000004",
    name: "QA-MKTG-Light Dan",
    email: "qa-test-4@repaircoin.test",
    totalSpentUsd: 100,
    visitCount: 2,
    daysSinceLastVisit: 25,
  },
  {
    address: "0xdead000000000000000000000000000000000005",
    name: "QA-MKTG-Newcomer Eve",
    email: "qa-test-5@repaircoin.test",
    totalSpentUsd: 50,
    visitCount: 1,
    daysSinceLastVisit: 14,
  },
  // --- Lapsed (3, all 100+ days since last visit) ---
  {
    address: "0xdead000000000000000000000000000000000006",
    name: "QA-MKTG-Lapsed Frank",
    email: "qa-test-6@repaircoin.test",
    totalSpentUsd: 200,
    visitCount: 3,
    daysSinceLastVisit: 100,
  },
  {
    address: "0xdead000000000000000000000000000000000007",
    name: "QA-MKTG-Lapsed Grace",
    email: "qa-test-7@repaircoin.test",
    totalSpentUsd: 150,
    visitCount: 2,
    daysSinceLastVisit: 130,
  },
  {
    address: "0xdead000000000000000000000000000000000008",
    name: "QA-MKTG-Lapsed Henry",
    email: "qa-test-8@repaircoin.test",
    totalSpentUsd: 75,
    visitCount: 1,
    daysSinceLastVisit: 180,
  },
  // --- Active (2, last 30 days — also covers Black Friday all_customers) ---
  {
    address: "0xdead000000000000000000000000000000000009",
    name: "QA-MKTG-Active Iris",
    email: "qa-test-9@repaircoin.test",
    totalSpentUsd: 80,
    visitCount: 2,
    daysSinceLastVisit: 5,
  },
  {
    address: "0xdead00000000000000000000000000000000000a",
    name: "QA-MKTG-Active Jay",
    email: "qa-test-10@repaircoin.test",
    totalSpentUsd: 60,
    visitCount: 1,
    daysSinceLastVisit: 3,
  },
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();
  try {
    console.log(`Connected — setup-marketing-fixtures`);
    console.log(`  SHOP_ID=${SHOP_ID}`);
    console.log(`  QA_MARKER=${QA_MARKER}`);
    console.log(`  Inserting ${FIXTURES.length} synthetic customers\n`);

    // Sanity check — shop exists.
    const shopCheck = await client.query(
      `SELECT shop_id FROM shops WHERE shop_id = $1`,
      [SHOP_ID]
    );
    if (shopCheck.rowCount === 0) {
      throw new Error(
        `Shop '${SHOP_ID}' not found. Update SHOP_ID at top of script to a real test shop, or seed the shop first.`
      );
    }

    let createdCustomers = 0;
    let createdTransactions = 0;

    for (const f of FIXTURES) {
      // 1. Upsert customer. ON CONFLICT (address) DO UPDATE — re-running
      // setup overwrites prior QA state cleanly.
      await client.query(
        `INSERT INTO customers (
           address, name, email, tier, is_active, join_date, created_at, updated_at
         ) VALUES ($1, $2, $3, 'BRONZE', true, NOW(), NOW(), NOW())
         ON CONFLICT (address) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           is_active = true,
           updated_at = NOW()`,
        [f.address.toLowerCase(), f.name, f.email]
      );
      createdCustomers += 1;

      // 2. Insert transactions. We split totalSpent across visitCount
      // distinct dates so visit_count and total_spent both line up.
      // Earliest transaction sits at daysSinceLastVisit + visitCount-1
      // days ago, most recent at daysSinceLastVisit days ago.
      const perVisitAmount = f.totalSpentUsd / Math.max(1, f.visitCount);
      for (let v = 0; v < f.visitCount; v++) {
        const daysAgo = f.daysSinceLastVisit + v;
        const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const txHash = `0xqa${QA_MARKER.replace(/[^a-z0-9]/gi, "").slice(0, 20)}${f.address.slice(-6)}${v}`;
        await client.query(
          `INSERT INTO transactions (
             type, customer_address, shop_id, amount, reason,
             transaction_hash, timestamp, status, created_at
           ) VALUES (
             'redemption', $1, $2, $3, $4, $5, $6, 'confirmed', $6
           )`,
          [
            f.address.toLowerCase(),
            SHOP_ID,
            perVisitAmount,
            QA_MARKER,
            txHash,
            ts.toISOString(),
          ]
        );
        createdTransactions += 1;
      }
    }

    console.log(`\n✓ Created/updated ${createdCustomers} customers`);
    console.log(`✓ Inserted ${createdTransactions} transactions`);
    console.log(`\nSegment distribution (expect this in lookup_audience_count):`);
    console.log(`  - top_spenders (top 20% = top 2): Whale Alice, Regular Bob`);
    console.log(`  - frequent_visitors (top 20% = top 2): Whale Alice, Regular Bob`);
    console.log(`  - active_customers (last 30d): all except 3 lapsed = 7 customers`);
    console.log(`  - custom minDaysSinceLastVisit=90: Frank, Grace, Henry`);
    console.log(`  - all_customers: 10 customers`);
    console.log(`\nNext steps:`);
    console.log(`  1. Open the shop dashboard as ${SHOP_ID}`);
    console.log(`  2. Tap the Megaphone launcher`);
    console.log(`  3. Run the test scenarios in qa-test-guide.md`);
    console.log(`  4. When done: run cleanup.ts`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("setup-marketing-fixtures failed:", err);
  process.exit(1);
});
