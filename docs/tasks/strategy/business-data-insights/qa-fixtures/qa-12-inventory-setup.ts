// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-12-inventory-setup.ts
//
// QA scenario §12 — Inventory toolkit (Phase 8.1 — Business-Data Insights).
// Seeds a deterministic inventory dataset for the test shop ('peanut')
// that exercises all 4 inventory tools end-to-end:
//   • inventory_summary    — mix of in-stock / low-stock / out-of-stock / discontinued
//   • low_stock_items      — 3 items below threshold with different deficit ratios
//                            (sort order is testable)
//   • inventory_turnover   — adjustments span 30/60/90d so fastest+slowest+empty
//                            paths can all be verified at different `range`
//   • inventory_value_trend — adjustments in BOTH current 30d AND prior 30-60d
//                             windows so the comparison has data on both sides
//
// All synthetic rows are marked so the cleanup script can target only
// them:
//   • inventory_items.name  LIKE 'QA-INV-%'
//   • inventory_adjustments.reason LIKE 'AINV-QA-%'
//
// Idempotent. If QA items already exist from a prior run, this script
// deletes them first (cascade-deletes their adjustments via FK) then
// re-seeds fresh.
//
// IMPORTANT — the inventory_items table has a BEFORE-INSERT trigger
// (`trigger_update_inventory_item_status`) that auto-rewrites `status`
// based on `stock_quantity` vs `low_stock_threshold`:
//   stock = 0                   → 'out_of_stock'
//   stock <= threshold          → 'low_stock'
//   stock > threshold (was low) → 'available'
//   else                        → preserves whatever you passed
// So this script inserts most rows with status='available' and relies
// on the trigger to flip low/OOS classification. Only 'discontinued'
// items need an explicit status — and they MUST have stock > threshold
// for the trigger to preserve the discontinued state.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-12-inventory-setup.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

const SHOP_ID = "peanut";

interface ItemSeed {
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  cost: number;
  price: number;
  status: "available" | "discontinued";
  // For documentation only — what the trigger should land at after insert.
  expected_resolved_status: "available" | "low_stock" | "out_of_stock" | "discontinued";
}

// 10 items engineered for predictable tool output. See header for math.
const ITEMS: ItemSeed[] = [
  // --- Healthy stock, fast movers (drive inventory_turnover 'fastest') ---
  {
    name: "QA-INV-iphone-12-screen",
    sku: "QA-IP12-SCR",
    stock_quantity: 25,
    low_stock_threshold: 5,
    cost: 35.0,
    price: 89.0,
    status: "available",
    expected_resolved_status: "available",
  },
  {
    name: "QA-INV-screen-protector",
    sku: "QA-SCRPROT",
    stock_quantity: 80,
    low_stock_threshold: 20,
    cost: 1.2,
    price: 9.99,
    status: "available",
    expected_resolved_status: "available",
  },
  {
    name: "QA-INV-battery-12pro",
    sku: "QA-BAT12P",
    stock_quantity: 12,
    low_stock_threshold: 3,
    cost: 22.0,
    price: 59.0,
    status: "available",
    expected_resolved_status: "available",
  },
  // --- Below threshold (drive low_stock_items) ---
  // Inserted as 'available'; trigger flips to 'low_stock' since
  // stock_quantity <= low_stock_threshold.
  {
    name: "QA-INV-charging-port",
    sku: "QA-CHGPRT",
    stock_quantity: 4, // 4 <= 5
    low_stock_threshold: 5,
    cost: 8.5,
    price: 25.0,
    status: "available",
    expected_resolved_status: "low_stock",
  },
  {
    name: "QA-INV-back-glass",
    sku: "QA-BKGLS",
    stock_quantity: 1, // 1 <= 6, deficit ratio 0.167 — TOP of low_stock_items
    low_stock_threshold: 6,
    cost: 18.0,
    price: 49.0,
    status: "available",
    expected_resolved_status: "low_stock",
  },
  {
    name: "QA-INV-display-adhesive",
    sku: "QA-DSPADH",
    stock_quantity: 2, // 2 <= 4, deficit ratio 0.50 — MIDDLE of low_stock_items
    low_stock_threshold: 4,
    cost: 0.75,
    price: 3.99,
    status: "available",
    expected_resolved_status: "low_stock",
  },
  // --- Slow + dead stock (drive inventory_turnover 'slowest') ---
  {
    name: "QA-INV-screwdriver-set",
    sku: "QA-SCRDRV",
    stock_quantity: 8,
    low_stock_threshold: 2,
    cost: 14.0,
    price: 29.99,
    status: "available",
    expected_resolved_status: "available",
  },
  {
    name: "QA-INV-suction-cup",
    sku: "QA-SUCTION",
    stock_quantity: 15,
    low_stock_threshold: 3,
    cost: 3.0,
    price: 7.99,
    status: "available",
    expected_resolved_status: "available",
  },
  // --- Out of stock ---
  {
    name: "QA-INV-ipad-screen",
    sku: "QA-IPADSC",
    stock_quantity: 0,
    low_stock_threshold: 2,
    cost: 65.0,
    price: 149.0,
    status: "available", // trigger flips to 'out_of_stock'
    expected_resolved_status: "out_of_stock",
  },
  // --- Discontinued (must be excluded from low_stock_items + turnover) ---
  // stock=5 > threshold=1 so the trigger PRESERVES discontinued.
  {
    name: "QA-INV-iphone7-screen",
    sku: "QA-IP7-SCR",
    stock_quantity: 5,
    low_stock_threshold: 1,
    cost: 25.0,
    price: 0.0,
    status: "discontinued",
    expected_resolved_status: "discontinued",
  },
];

interface AdjustmentSeed {
  itemKey: string; // ITEMS.name slug
  adjustment_type: "sale" | "purchase" | "damage" | "loss" | "manual" | "return" | "recount" | "transfer";
  quantity_change: number;
  days_ago: number;
  reason: string; // must start with 'AINV-QA-' for cleanup
}

// Adjustments across THREE windows so all three `range` values exercise
// real data:
//   • 1-29 days ago     → counted in '7d'? (only when days_ago < 7), '30d', '90d'
//   • 30-59 days ago    → counted in '90d' only (prior window for value_trend)
//   • 60-89 days ago    → counted in '90d' only (further past, sparse)
//
// inventory_turnover units-used in last 30d (after this seed):
//   QA-INV-screen-protector  = 25  ← fastest by units
//   QA-INV-iphone-12-screen  = 8
//   QA-INV-battery-12pro     = 4
//   QA-INV-back-glass        = 2
//   QA-INV-display-adhesive  = 1
//   QA-INV-charging-port     = 1
//   QA-INV-screwdriver-set   = 0  ← slowest (zero-usage path)
//   QA-INV-suction-cup       = 0  ← slowest (zero-usage path; ties broken by name ASC)
//
// inventory_value_trend (current 30d vs prior 30d):
//   Current 30d net delta:
//     Sales (negative):  -8*35 -25*1.20 -4*22 -2*18 -1*8.50 -1*0.75 = -443.25
//     Purchases (pos):   +20*35 (iphone) +50*1.20 (protector)       = +760.00
//     Damage (neg, small): -1*22 (battery)                          = -22.00
//     Net:                                                          ≈ +294.75
//   Prior 30-60d net delta:
//     Sales (negative):  -5*35 -10*1.20 -2*22                       = -231.00
//     Net:                                                          ≈ -231.00
//   Delta vs prior: +294.75 - (-231) ≈ +525.75 → 'up' / 'large'
//     (sentiment is 'neutral' per tool spec — restocking vs sales ambiguity)

const ADJUSTMENTS: AdjustmentSeed[] = [
  // ===== CURRENT 30d window — sales spread across last 29 days =====
  // iPhone-12 screen: 8 sales
  ...spreadSales("QA-INV-iphone-12-screen", 8, 1, 28, "AINV-QA-12.3-fastest"),
  // Screen protector: 25 sales
  ...spreadSales("QA-INV-screen-protector", 25, 1, 28, "AINV-QA-12.3-fastest"),
  // Battery: 4 sales + 1 damage
  ...spreadSales("QA-INV-battery-12pro", 4, 2, 25, "AINV-QA-12.3-mid"),
  {
    itemKey: "QA-INV-battery-12pro",
    adjustment_type: "damage",
    quantity_change: -1,
    days_ago: 10,
    reason: "AINV-QA-12.3-damage",
  },
  // Back-glass: 2 sales
  ...spreadSales("QA-INV-back-glass", 2, 5, 20, "AINV-QA-12.3-mid"),
  // Charging-port: 1 sale
  {
    itemKey: "QA-INV-charging-port",
    adjustment_type: "sale",
    quantity_change: -1,
    days_ago: 8,
    reason: "AINV-QA-12.3-mid",
  },
  // Display-adhesive: 1 sale
  {
    itemKey: "QA-INV-display-adhesive",
    adjustment_type: "sale",
    quantity_change: -1,
    days_ago: 12,
    reason: "AINV-QA-12.3-mid",
  },
  // ----- Purchases (restock) in current 30d, drives value_trend +ve -----
  {
    itemKey: "QA-INV-iphone-12-screen",
    adjustment_type: "purchase",
    quantity_change: 20,
    days_ago: 15,
    reason: "AINV-QA-12.4-restock",
  },
  {
    itemKey: "QA-INV-screen-protector",
    adjustment_type: "purchase",
    quantity_change: 50,
    days_ago: 20,
    reason: "AINV-QA-12.4-restock",
  },

  // ===== PRIOR 30-60d window — drives value_trend prior figure =====
  // iPhone-12 screen: 5 sales
  ...spreadSales("QA-INV-iphone-12-screen", 5, 32, 55, "AINV-QA-12.4-prior"),
  // Screen protector: 10 sales
  ...spreadSales("QA-INV-screen-protector", 10, 32, 58, "AINV-QA-12.4-prior"),
  // Battery: 2 sales
  ...spreadSales("QA-INV-battery-12pro", 2, 40, 50, "AINV-QA-12.4-prior"),

  // ===== 60-89d window — sparse, only counted in 90d range =====
  // Just a couple sales so '90d' has more data than '30d'
  {
    itemKey: "QA-INV-iphone-12-screen",
    adjustment_type: "sale",
    quantity_change: -1,
    days_ago: 70,
    reason: "AINV-QA-12.3-far-past",
  },
  {
    itemKey: "QA-INV-back-glass",
    adjustment_type: "sale",
    quantity_change: -1,
    days_ago: 85,
    reason: "AINV-QA-12.3-far-past",
  },
];

/**
 * Generate N sale adjustments for a single item, spread evenly across
 * `firstDaysAgo`..`lastDaysAgo`. Each adjustment removes 1 unit.
 */
function spreadSales(
  itemKey: string,
  count: number,
  firstDaysAgo: number,
  lastDaysAgo: number,
  reasonPrefix: string
): AdjustmentSeed[] {
  if (count <= 0) return [];
  const out: AdjustmentSeed[] = [];
  const span = Math.max(1, lastDaysAgo - firstDaysAgo);
  for (let i = 0; i < count; i++) {
    const days_ago =
      count === 1
        ? Math.round((firstDaysAgo + lastDaysAgo) / 2)
        : Math.round(firstDaysAgo + (span * i) / (count - 1));
    out.push({
      itemKey,
      adjustment_type: "sale",
      quantity_change: -1,
      days_ago,
      reason: `${reasonPrefix}-${itemKey.slice(8)}-${i + 1}`,
    });
  }
  return out;
}

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
    console.log(`Connected — seeding §12 inventory fixtures for shop='${SHOP_ID}'\n`);

    // 1. Clean any leftover QA items from a prior run. Cascade-deletes
    //    their adjustments via FK.
    const wiped = await client.query(
      `DELETE FROM inventory_items
       WHERE shop_id = $1 AND name LIKE 'QA-INV-%'`,
      [SHOP_ID]
    );
    console.log(`Step 1 — Wiped ${wiped.rowCount} leftover QA-INV-% item(s) (adjustments cascaded).`);

    // 2. Insert items + capture their generated UUIDs by name.
    const idByName = new Map<string, string>();
    console.log("\nStep 2 — Inserting 10 inventory items:");
    for (const it of ITEMS) {
      const res = await client.query<{ id: string; status: string }>(
        `INSERT INTO inventory_items
           (shop_id, name, sku, stock_quantity, low_stock_threshold,
            cost, price, status, reserved_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
         RETURNING id, status`,
        [
          SHOP_ID,
          it.name,
          it.sku,
          it.stock_quantity,
          it.low_stock_threshold,
          it.cost,
          it.price,
          it.status,
        ]
      );
      const row = res.rows[0];
      idByName.set(it.name, row.id);
      const match = row.status === it.expected_resolved_status ? "✓" : "⚠";
      console.log(
        `  ${match} ${it.name.padEnd(28)} stock=${String(it.stock_quantity).padEnd(3)} thr=${String(it.low_stock_threshold).padEnd(3)} → status=${row.status} (expected ${it.expected_resolved_status})`
      );
    }

    // 3. Insert adjustments. Each row needs item_id (UUID), shop_id,
    //    adjustment_type, quantity_change, quantity_before, quantity_after.
    //    The tools never query quantity_before/quantity_after so we can
    //    use placeholder values — but the columns are NOT NULL, so we
    //    pass something plausible: before = stock - quantity_change,
    //    after = stock. (Doesn't have to match the real chronology.)
    console.log(`\nStep 3 — Inserting ${ADJUSTMENTS.length} adjustments:`);
    const stockByName = new Map(ITEMS.map((it) => [it.name, it.stock_quantity]));
    let inserted = 0;
    for (const adj of ADJUSTMENTS) {
      const itemId = idByName.get(adj.itemKey);
      if (!itemId) {
        console.warn(`  ⚠ Skipped — unknown itemKey '${adj.itemKey}'`);
        continue;
      }
      const stockNow = stockByName.get(adj.itemKey) ?? 0;
      const before = Math.max(0, stockNow - adj.quantity_change);
      const after = stockNow; // post-adjustment stock = current stock_quantity
      await client.query(
        `INSERT INTO inventory_adjustments
           (item_id, shop_id, adjustment_type, quantity_change,
            quantity_before, quantity_after, reason, created_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7,
            NOW() - ($8::int || ' days')::interval)`,
        [
          itemId,
          SHOP_ID,
          adj.adjustment_type,
          adj.quantity_change,
          before,
          after,
          adj.reason,
          adj.days_ago,
        ]
      );
      inserted++;
    }
    console.log(`  Inserted ${inserted} adjustment row(s).`);

    // 4. Read-back sanity checks — what each tool should see.
    console.log("\nStep 4 — Read-back sanity checks:");

    const summary = await client.query<{
      items_in_stock: string;
      items_low_stock: string;
      items_out_of_stock: string;
      items_discontinued: string;
      total_inventory_value: string;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE stock_quantity > 0
             AND status NOT IN ('out_of_stock', 'discontinued')
         )::text AS items_in_stock,
         COUNT(*) FILTER (
           WHERE stock_quantity > 0
             AND stock_quantity <= low_stock_threshold
             AND status NOT IN ('out_of_stock', 'discontinued')
         )::text AS items_low_stock,
         COUNT(*) FILTER (
           WHERE stock_quantity = 0
             OR status = 'out_of_stock'
         )::text AS items_out_of_stock,
         COUNT(*) FILTER (WHERE status = 'discontinued')::text AS items_discontinued,
         COALESCE(SUM(
           CASE WHEN status = 'discontinued' THEN 0 ELSE stock_quantity * cost END
         ), 0)::text AS total_inventory_value
       FROM inventory_items
       WHERE shop_id = $1
         AND deleted_at IS NULL
         AND name LIKE 'QA-INV-%'`,
      [SHOP_ID]
    );
    const s = summary.rows[0];
    console.log(
      `  inventory_summary (QA-only): in_stock=${s.items_in_stock} low=${s.items_low_stock} oos=${s.items_out_of_stock} disc=${s.items_discontinued} value=$${parseFloat(s.total_inventory_value).toFixed(2)}`
    );

    const low = await client.query<{ name: string; stock_quantity: number; low_stock_threshold: number }>(
      `SELECT name, stock_quantity, low_stock_threshold
       FROM inventory_items
       WHERE shop_id = $1
         AND deleted_at IS NULL
         AND status <> 'discontinued'
         AND stock_quantity <= low_stock_threshold
         AND name LIKE 'QA-INV-%'
       ORDER BY (stock_quantity::float / NULLIF(low_stock_threshold, 0)) ASC NULLS FIRST,
                name ASC`,
      [SHOP_ID]
    );
    console.log(`  low_stock_items (QA-only, ${low.rowCount} row(s)):`);
    low.rows.forEach((r, i) =>
      console.log(`    ${i + 1}. ${r.name.padEnd(28)} ${r.stock_quantity}/${r.low_stock_threshold}`)
    );

    const turn30 = await client.query<{ name: string; units_used: string }>(
      `WITH usage AS (
         SELECT a.item_id, SUM(ABS(a.quantity_change)) AS units_used
         FROM inventory_adjustments a
         WHERE a.shop_id = $1
           AND a.adjustment_type IN ('sale', 'damage', 'loss')
           AND a.quantity_change < 0
           AND a.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY a.item_id
       )
       SELECT i.name, COALESCE(u.units_used, 0)::text AS units_used
       FROM inventory_items i
       LEFT JOIN usage u ON i.id = u.item_id
       WHERE i.shop_id = $1
         AND i.deleted_at IS NULL
         AND i.status <> 'discontinued'
         AND i.name LIKE 'QA-INV-%'
       ORDER BY COALESCE(u.units_used, 0) DESC, i.name ASC`,
      [SHOP_ID]
    );
    console.log(`  inventory_turnover (last 30d, QA-only, fastest sort):`);
    turn30.rows.forEach((r) =>
      console.log(`    ${r.name.padEnd(28)} used=${r.units_used}`)
    );

    const trend = await client.query<{
      current_delta: string;
      prior_delta: string;
    }>(
      `WITH cur AS (
         SELECT COALESCE(SUM(a.quantity_change * i.cost), 0) AS d
         FROM inventory_adjustments a
         JOIN inventory_items i ON a.item_id = i.id
         WHERE a.shop_id = $1
           AND i.name LIKE 'QA-INV-%'
           AND a.created_at >= NOW() - INTERVAL '30 days'
       ),
       prior AS (
         SELECT COALESCE(SUM(a.quantity_change * i.cost), 0) AS d
         FROM inventory_adjustments a
         JOIN inventory_items i ON a.item_id = i.id
         WHERE a.shop_id = $1
           AND i.name LIKE 'QA-INV-%'
           AND a.created_at >= NOW() - INTERVAL '60 days'
           AND a.created_at < NOW() - INTERVAL '30 days'
       )
       SELECT cur.d::text AS current_delta, prior.d::text AS prior_delta
       FROM cur, prior`,
      [SHOP_ID]
    );
    const t = trend.rows[0];
    console.log(
      `  inventory_value_trend (QA-only): current_30d=$${parseFloat(t.current_delta).toFixed(2)} prior_30d=$${parseFloat(t.prior_delta).toFixed(2)}`
    );

    console.log(
      "\n✓ §12 setup complete. Open the Insights panel and run the §12 scenarios."
    );
    console.log(
      "  When done, run qa-12-inventory-cleanup.ts to remove the synthetic data."
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§12 setup failed:", err);
  process.exit(1);
});
