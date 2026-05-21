// Smoke test for Phase 2.2 — top_customers tool.
//
// Against real DO data:
//   - all 3 `by` modes against the 'peanut' shop, all-time + 30d window
//   - tool top-1 + top-3 values match hand-rolled SQL references
//   - ranks are strictly monotonic (descending values)
//   - name resolution: every row resolves to a non-empty display name
//     (one of name / first+last / email / 0xabcd…wxyz fallback)
//   - shop-scoping: fake shopId returns empty customers
//   - bad args: invalid by / out-of-range limit fail at dispatcher
//
// Run: npx ts-node scripts/smoke-tool-top-customers.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import { topCustomers } from "../src/domains/AIAgentDomain/services/insights/tools/topCustomers";
import { ToolContext } from "../src/domains/AIAgentDomain/services/insights/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(64)} ${detail}`);
  ok ? pass++ : fail++;
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface RefRow {
  customer_address: string;
  value: number;
}

async function refSpend(pool: Pool, shop: string, days: number | null, limit: number): Promise<RefRow[]> {
  const conds = [`shop_id = $1`, `status IN ('paid','completed')`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const r = await pool.query<{ customer_address: string; total: string }>(
    `SELECT customer_address, SUM(total_amount)::text AS total
     FROM service_orders WHERE ${conds.join(" AND ")}
     GROUP BY customer_address
     ORDER BY SUM(total_amount) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({ customer_address: x.customer_address, value: Number(x.total) }));
}

async function refOrderCount(pool: Pool, shop: string, days: number | null, limit: number): Promise<RefRow[]> {
  const conds = [`shop_id = $1`, `status IN ('paid','completed')`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const r = await pool.query<{ customer_address: string; n: string }>(
    `SELECT customer_address, COUNT(*)::text AS n
     FROM service_orders WHERE ${conds.join(" AND ")}
     GROUP BY customer_address
     ORDER BY COUNT(*) DESC, SUM(total_amount) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({ customer_address: x.customer_address, value: Number(x.n) }));
}

async function refRcn(pool: Pool, shop: string, days: number | null, limit: number): Promise<RefRow[]> {
  const conds = [`shop_id = $1`, `type IN ('mint','tier_bonus')`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const r = await pool.query<{ customer_address: string; rcn: string }>(
    `SELECT customer_address, SUM(amount)::text AS rcn
     FROM transactions WHERE ${conds.join(" AND ")}
     GROUP BY customer_address
     ORDER BY SUM(amount) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({ customer_address: x.customer_address, value: Number(x.rcn) }));
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

  const matrix: Array<{ by: "rcn_earned" | "spend" | "order_count"; range: "30d" | "all" }> = [
    { by: "spend", range: "all" },
    { by: "spend", range: "30d" },
    { by: "order_count", range: "all" },
    { by: "order_count", range: "30d" },
    { by: "rcn_earned", range: "all" },
    { by: "rcn_earned", range: "30d" },
  ];

  for (const { by, range } of matrix) {
    console.log(`\n=== by='${by}' range='${range}' limit=5 ===`);
    const r = await dispatchTool(topCustomers, { by, range, limit: 5 }, ctx);
    check(`${by}/${range} dispatch ok`, r.ok === true, r.error ?? "");
    if (!r.ok || !r.result) continue;

    const data = r.result.data as {
      by: string; range: string; count: number;
      customers: Array<{ rank: number; name: string; value: number; orderCount: number }>;
    };
    const display = r.result.display as { kind: string; columns: string[]; rows: Array<Array<string | number>> };

    // Resolve reference set.
    const days = range === "all" ? null : RANGE_DAYS[range];
    const ref =
      by === "spend" ? await refSpend(pool, SHOP, days, 5)
      : by === "order_count" ? await refOrderCount(pool, SHOP, days, 5)
      : await refRcn(pool, SHOP, days, 5);

    check(`${by}/${range} count matches reference`, data.count === ref.length, `tool=${data.count} ref=${ref.length}`);
    if (data.count > 0 && ref.length > 0) {
      // Top-1 row should match exactly.
      check(
        `${by}/${range} top-1 value matches`,
        Math.abs(data.customers[0].value - ref[0].value) < 0.001,
        `tool=${data.customers[0].value} ref=${ref[0].value}`
      );
      // Ranks strictly monotonic (descending).
      const desc = data.customers.every((c, i) =>
        i === 0 ? true : c.value <= data.customers[i - 1].value
      );
      check(`${by}/${range} ranks strictly descending`, desc);
      // Sum of top-3 (or available) values matches ref top-3.
      const k = Math.min(3, data.customers.length, ref.length);
      const sumTool = data.customers.slice(0, k).reduce((a, c) => a + c.value, 0);
      const sumRef = ref.slice(0, k).reduce((a, x) => a + x.value, 0);
      check(
        `${by}/${range} sum-of-top-${k} matches`,
        Math.abs(sumTool - sumRef) < 0.001,
        `tool=${sumTool} ref=${sumRef}`
      );
      // Display row count matches data row count.
      check(`${by}/${range} display.rows.length === data.count`, display.rows.length === data.count);
      // Every name is a non-empty string.
      const allNamed = data.customers.every((c) => typeof c.name === "string" && c.name.length > 0);
      check(`${by}/${range} every row has a non-empty display name`, allNamed);
      // Display column header matches the chosen metric.
      const expectedHeader = by === "spend" ? "Spend" : by === "rcn_earned" ? "RCN Earned" : "Orders";
      check(
        `${by}/${range} value column header = '${expectedHeader}'`,
        display.columns[2] === expectedHeader,
        `got '${display.columns[2]}'`
      );
    }
  }

  // Shop-scoping defense.
  console.log("\n=== Shop-scoping defense ===");
  {
    const fakeCtx: ToolContext = { shopId: "this-shop-does-not-exist-zzz", pool };
    const r = await dispatchTool(topCustomers, { by: "spend", range: "all", limit: 5 }, fakeCtx);
    check("fake shop dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const d = r.result.data as { count: number };
      check("fake shop returns 0 customers", d.count === 0);
    }
  }

  // Bad args at dispatcher boundary.
  console.log("\n=== Bad args caught by dispatcher ===");
  {
    const r = await dispatchTool(topCustomers, { by: "rcn", range: "all", limit: 5 }, ctx);
    check("bad by value → ok=false", !r.ok && /must be one of/.test(r.error ?? ""), r.error ?? "");
  }
  {
    const r = await dispatchTool(topCustomers, { by: "spend", range: "all", limit: 0 }, ctx);
    check("limit=0 → ok=false", !r.ok && /must be >= 1/.test(r.error ?? ""), r.error ?? "");
  }
  {
    const r = await dispatchTool(topCustomers, { by: "spend", range: "all", limit: 11 }, ctx);
    check("limit=11 → ok=false", !r.ok && /must be <= 10/.test(r.error ?? ""), r.error ?? "");
  }

  await pool.end();
  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
