// Smoke test for Phase 2.4 — bookings_breakdown tool.
//
// Against real DO data (peanut shop):
//   - {7d, 30d, 90d, all} ranges
//   - byStatus counts match hand-rolled SQL references
//   - canonical statuses always present (zero when absent)
//   - display total + per-status formatting
//   - percentages sum to ~100% when total > 0
//   - empty window (zero rows) renders cleanly
//   - shop-scoping defense
//   - bad-arg branches at dispatcher
//
// Run: npx ts-node scripts/smoke-tool-bookings-breakdown.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import { bookingsBreakdown } from "../src/domains/AIAgentDomain/services/insights/tools/bookingsBreakdown";
import { ToolContext } from "../src/domains/AIAgentDomain/services/insights/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(64)} ${detail}`);
  ok ? pass++ : fail++;
};

const CANONICAL = [
  "completed", "paid", "pending", "cancelled", "no_show", "expired", "refunded",
];
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

async function refBreakdown(pool: Pool, shop: string, days: number | null) {
  const conds = [`shop_id = $1`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  const r = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM service_orders
     WHERE ${conds.join(" AND ")} GROUP BY status`,
    params
  );
  const out: Record<string, number> = {};
  for (const s of CANONICAL) out[s] = 0;
  for (const row of r.rows) out[row.status] = Number(row.n);
  return out;
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  const SHOP = "peanut";
  const ctx: ToolContext = { shopId: SHOP, pool };

  for (const range of ["7d", "30d", "90d", "all"] as const) {
    console.log(`\n=== range='${range}' ===`);
    const r = await dispatchTool(bookingsBreakdown, { range }, ctx);
    check(`${range} dispatch ok`, r.ok === true, r.error ?? "");
    if (!r.ok || !r.result) continue;

    const data = r.result.data as {
      range: string; total: number; byStatus: Record<string, number>;
    };
    const display = r.result.display as { kind: string; items: Array<{ label: string; value: string }> };

    const ref = await refBreakdown(pool, SHOP, range === "all" ? null : RANGE_DAYS[range]);
    const refTotal = Object.values(ref).reduce((a, b) => a + b, 0);

    check(`${range} total matches ref`, data.total === refTotal, `tool=${data.total} ref=${refTotal}`);

    // Every canonical status present (zero or otherwise).
    const allCanonicalPresent = CANONICAL.every((s) => typeof data.byStatus[s] === "number");
    check(`${range} all canonical statuses present in byStatus`, allCanonicalPresent);

    // Each canonical count matches ref.
    let mismatched: string[] = [];
    for (const s of CANONICAL) {
      if (data.byStatus[s] !== ref[s]) mismatched.push(`${s}: tool=${data.byStatus[s]} ref=${ref[s]}`);
    }
    check(`${range} all canonical counts match ref`, mismatched.length === 0, mismatched.join("; "));

    // Display: first item is total
    check(
      `${range} display item[0] is total`,
      display.items[0]?.label === "Total bookings" && display.items[0]?.value === String(refTotal)
    );
    // 1 total + 7 canonical (extras may add more)
    check(
      `${range} display has at least 8 items (total + 7 canonical)`,
      display.items.length >= 8,
      `got ${display.items.length}`
    );

    // Percentages: when total > 0, sum of non-zero counted statuses' pct should be ~100
    if (data.total > 0) {
      const pctSum = display.items
        .slice(1) // skip total row
        .map((i) => {
          const m = /\((\d+\.\d+)%\)/.exec(i.value);
          return m ? Number(m[1]) : 0;
        })
        .reduce((a, b) => a + b, 0);
      check(
        `${range} percentages sum ≈ 100`,
        Math.abs(pctSum - 100) < 0.5,
        `sum=${pctSum.toFixed(2)}%`
      );
    } else {
      const allZero = display.items.slice(1).every((i) => i.value === "0");
      check(`${range} all status values are '0' when total=0`, allZero);
    }
  }

  // Shop-scoping defense
  console.log("\n=== Shop-scoping defense ===");
  {
    const fake: ToolContext = { shopId: "this-shop-does-not-exist-zzz", pool };
    const r = await dispatchTool(bookingsBreakdown, { range: "all" }, fake);
    check("fake shop dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const d = r.result.data as { total: number; byStatus: Record<string, number> };
      check("fake shop total = 0", d.total === 0);
      const allZero = CANONICAL.every((s) => d.byStatus[s] === 0);
      check("fake shop every canonical status = 0", allZero);
    }
  }

  // Bad args
  console.log("\n=== Bad args ===");
  {
    const r = await dispatchTool(bookingsBreakdown, { range: "yearly" }, ctx);
    check("bad range → ok=false", !r.ok && /must be one of/.test(r.error ?? ""), r.error ?? "");
  }
  {
    const r = await dispatchTool(bookingsBreakdown, {}, ctx);
    check("missing range → ok=false", !r.ok && /missing required/.test(r.error ?? ""), r.error ?? "");
  }

  await pool.end();
  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
