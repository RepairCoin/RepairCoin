// docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/seed-test-shop.ts
//
// Phase 6 readiness check. Voice routing only feels real if, AFTER the
// router picks a domain, the matching panel actually has something to say.
// This script does NOT generate campaigns or analytics — those flows are
// driven by the panels' own agents. Instead it VERIFIES the designated test
// shop has enough underlying data that each routed panel responds
// meaningfully, and tells you which seeders to run if it doesn't.
//
//   - INSIGHTS  → needs transactions + customers + (for the "low stock"
//                 fixture) inventory items. Reuse the inventory seeder from
//                 business-data-insights §12 if inventory is empty (see
//                 pointer printed below).
//   - MARKETING → needs a customer base to build an audience from.
//   - HELP      → static product knowledge; no shop data required.
//
// Connects to the DB the backend's .env points at (DigitalOcean Postgres —
// there is NO separate staging DB; same convention as the other fixtures).
// Read-only: it runs COUNTs, never writes. Safe to run anytime.
//
//   cd backend
//   VOICE_QA_SHOP_ID=peanut \
//   npx ts-node ../docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/seed-test-shop.ts

import * as dotenv from "dotenv";
import {
  getSharedPool,
  closeSharedPool,
} from "../../../../../backend/src/utils/database-pool";

dotenv.config(); // CWD=backend → backend/.env

// Reuse the backend's own pool so we connect exactly like the app does —
// supports both DATABASE_URL and the DB_HOST/DB_NAME/DB_USER/... env style,
// plus the DigitalOcean SSL handling. Don't rebuild a Pool by hand here.

const SHOP_ID = process.env.VOICE_QA_SHOP_ID ?? "peanut";

interface Check {
  label: string;
  /** Domain(s) that depend on this data. */
  forDomain: string;
  /** COUNT query; $1 is the shop id. */
  sql: string;
  /** Minimum rows for the routed panel to respond meaningfully. */
  min: number;
  /** Printed when the count is below `min`. */
  remedy: string;
}

const CHECKS: Check[] = [
  {
    label: "customers (any)",
    forDomain: "insights + marketing",
    sql: `SELECT COUNT(DISTINCT customer_address) AS n FROM transactions WHERE shop_id = $1`,
    min: 3,
    remedy:
      "Run a few earn/redeem flows for this shop, or use an existing busy shop as VOICE_QA_SHOP_ID.",
  },
  {
    label: "transactions (last 90d)",
    forDomain: "insights",
    sql: `SELECT COUNT(*) AS n FROM transactions WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '90 days'`,
    min: 10,
    remedy:
      "Insights revenue/top-customer answers need recent transactions. Issue some test rewards/redemptions.",
  },
  {
    label: "inventory items (active)",
    forDomain: "insights (low-stock fixture)",
    sql: `SELECT COUNT(*) AS n FROM inventory_items WHERE shop_id = $1`,
    min: 3,
    remedy:
      "Seed inventory via business-data-insights §12: cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-12-inventory-setup.ts",
  },
];

async function main(): Promise<void> {
  const pool = getSharedPool();

  console.log(`\nVoice Dispatcher — Phase 6 test-shop readiness`);
  console.log(`  Shop: ${SHOP_ID}\n`);

  // Confirm the shop exists first (replay's minted JWT requires this).
  const shop = await pool.query(
    "SELECT shop_id, active FROM shops WHERE shop_id = $1 LIMIT 1",
    [SHOP_ID]
  );
  if (shop.rowCount === 0) {
    console.error(
      `❌ Shop '${SHOP_ID}' does not exist. replay-fixtures.ts auth will fail (auth.ts validateUserInDatabase rejects unknown shops). Pick a real shop_id.`
    );
    await pool.end();
    process.exit(1);
  }
  if (shop.rows[0].active === false) {
    console.warn(`⚠ Shop '${SHOP_ID}' is inactive — auth may reject it.`);
  } else {
    console.log(`✅ Shop '${SHOP_ID}' exists and is active.\n`);
  }

  let anyBlocking = false;
  for (const c of CHECKS) {
    let n = -1;
    let err: string | null = null;
    try {
      const r = await pool.query(c.sql, [SHOP_ID]);
      n = Number(r.rows[0]?.n ?? 0);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    if (err) {
      console.log(
        `❓ ${c.label.padEnd(28)} [${c.forDomain}] — query failed: ${err}`
      );
      console.log(`     (table/column name may differ — adjust the SQL in CHECKS)`);
      continue;
    }

    const ok = n >= c.min;
    if (!ok) anyBlocking = true;
    console.log(
      `${ok ? "✅" : "⚠ "} ${c.label.padEnd(28)} [${c.forDomain}] — ${n} (need ≥ ${c.min})`
    );
    if (!ok) console.log(`     ↳ ${c.remedy}`);
  }

  console.log(
    anyBlocking
      ? "\nSome panels may give thin answers. Address the ⚠ rows above, then run replay-fixtures.ts.\n"
      : "\nTest shop looks ready. Record the 10 clips (pre-recorded-audio/README.md), then run replay-fixtures.ts.\n"
  );

  await closeSharedPool();
}

main().catch((err) => {
  console.error("seed-test-shop fatal:", err);
  process.exit(1);
});
