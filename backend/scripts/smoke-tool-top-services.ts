// Smoke test for Phase 2.3 — top_services tool.
//
// Against real DO data (peanut shop):
//   - revenue × {all, 30d}: tool top-1 + sum-top-3 match hand-rolled refs
//   - bookings × {all, 30d}: same, ALL-status COUNT
//   - conversion × {all}: ratio matches hand-computed paid/conversations,
//     services with 0 conversations are excluded from the ranking
//   - rank monotonicity, display column header, service name resolution
//   - shop-scoping defense
//   - bad-arg branches at dispatcher
//
// Run: npx ts-node scripts/smoke-tool-top-services.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import { topServices } from "../src/domains/AIAgentDomain/services/insights/tools/topServices";
import { ToolContext } from "../src/domains/AIAgentDomain/services/insights/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(72)} ${detail}`);
  ok ? pass++ : fail++;
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface RefRow { service_id: string; value: number; }

async function refRevenue(pool: Pool, shop: string, days: number | null, limit: number): Promise<RefRow[]> {
  const conds = [`shop_id = $1`, `status IN ('paid','completed')`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const r = await pool.query<{ service_id: string; total: string }>(
    `SELECT service_id, SUM(total_amount)::text AS total
     FROM service_orders WHERE ${conds.join(" AND ")}
     GROUP BY service_id
     ORDER BY SUM(total_amount) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({ service_id: x.service_id, value: Number(x.total) }));
}

async function refBookings(pool: Pool, shop: string, days: number | null, limit: number): Promise<RefRow[]> {
  const conds = [`shop_id = $1`];
  const params: unknown[] = [shop];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    conds.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const r = await pool.query<{ service_id: string; n: string }>(
    `SELECT service_id, COUNT(*)::text AS n
     FROM service_orders WHERE ${conds.join(" AND ")}
     GROUP BY service_id
     ORDER BY COUNT(*) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({ service_id: x.service_id, value: Number(x.n) }));
}

async function refConversion(pool: Pool, shop: string, days: number | null, limit: number) {
  const params: unknown[] = [shop];
  let windowOrders = "";
  let windowConvos = "";
  if (days !== null) {
    params.push(new Date(Date.now() - days * 86400000));
    windowOrders = `AND o.created_at >= $${params.length}`;
    windowConvos = `AND c.created_at >= $${params.length}`;
  }
  params.push(limit);
  const r = await pool.query<{
    service_id: string;
    paid_n: string;
    conv_n: string;
  }>(
    `WITH orders AS (
       SELECT o.service_id, COUNT(*) AS paid_n
       FROM service_orders o
       WHERE o.shop_id = $1 AND o.status IN ('paid','completed') ${windowOrders}
       GROUP BY o.service_id
     ),
     convos AS (
       SELECT c.service_id, COUNT(*) AS conv_n
       FROM conversations c
       WHERE c.shop_id = $1 AND c.service_id IS NOT NULL ${windowConvos}
       GROUP BY c.service_id
     )
     SELECT s.service_id,
            COALESCE(orders.paid_n, 0)::text AS paid_n,
            convos.conv_n::text AS conv_n
     FROM shop_services s
     LEFT JOIN orders ON orders.service_id = s.service_id
     INNER JOIN convos ON convos.service_id = s.service_id
     WHERE s.shop_id = $1
     ORDER BY (COALESCE(orders.paid_n,0)::numeric / convos.conv_n) DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map((x) => ({
    service_id: x.service_id,
    paid: Number(x.paid_n),
    conv: Number(x.conv_n),
    value: Number(x.paid_n) / Number(x.conv_n),
  }));
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

  for (const range of ["all", "30d"] as const) {
    for (const by of ["revenue", "bookings"] as const) {
      console.log(`\n=== by='${by}' range='${range}' limit=5 ===`);
      const r = await dispatchTool(topServices, { by, range, limit: 5 }, ctx);
      check(`${by}/${range} dispatch ok`, r.ok === true, r.error ?? "");
      if (!r.ok || !r.result) continue;

      const data = r.result.data as {
        count: number;
        services: Array<{ rank: number; name: string; serviceId: string; value: number }>;
      };
      const display = r.result.display as { kind: string; columns: string[]; rows: Array<Array<string | number>> };
      const days = range === "all" ? null : RANGE_DAYS[range];
      const ref = by === "revenue"
        ? await refRevenue(pool, SHOP, days, 5)
        : await refBookings(pool, SHOP, days, 5);

      check(`${by}/${range} count matches ref`, data.count === ref.length, `tool=${data.count} ref=${ref.length}`);
      if (data.count > 0 && ref.length > 0) {
        check(
          `${by}/${range} top-1 value matches`,
          Math.abs(data.services[0].value - ref[0].value) < 0.001,
          `tool=${data.services[0].value} ref=${ref[0].value}`
        );
        check(
          `${by}/${range} top-1 serviceId matches`,
          data.services[0].serviceId === ref[0].service_id,
          `tool=${data.services[0].serviceId} ref=${ref[0].service_id}`
        );
        const desc = data.services.every((s, i) => i === 0 ? true : s.value <= data.services[i - 1].value);
        check(`${by}/${range} ranks descending`, desc);
        const k = Math.min(3, data.services.length, ref.length);
        const sumTool = data.services.slice(0, k).reduce((a, s) => a + s.value, 0);
        const sumRef = ref.slice(0, k).reduce((a, x) => a + x.value, 0);
        check(`${by}/${range} sum-top-${k} matches`, Math.abs(sumTool - sumRef) < 0.001, `tool=${sumTool} ref=${sumRef}`);
        const allNamed = data.services.every((s) => typeof s.name === "string" && s.name.length > 0);
        check(`${by}/${range} every row has display name`, allNamed);
        const expectedHeader = by === "revenue" ? "Revenue" : "Bookings";
        check(`${by}/${range} column header = '${expectedHeader}'`, display.columns[2] === expectedHeader);
        check(`${by}/${range} display.rows.length === count`, display.rows.length === data.count);
      }
    }
  }

  // Conversion (all-time only — small data set, narrow window unlikely to have signal)
  console.log("\n=== by='conversion' range='all' limit=5 ===");
  {
    const r = await dispatchTool(topServices, { by: "conversion", range: "all", limit: 5 }, ctx);
    check("conversion dispatch ok", r.ok === true, r.error ?? "");
    if (r.ok && r.result) {
      const data = r.result.data as {
        count: number;
        services: Array<{ rank: number; name: string; value: number; paidBookings: number; conversations: number }>;
      };
      const ref = await refConversion(pool, SHOP, null, 5);
      check("conversion count matches ref", data.count === ref.length, `tool=${data.count} ref=${ref.length}`);

      if (data.count > 0 && ref.length > 0) {
        check(
          "conversion top-1 value matches",
          Math.abs(data.services[0].value - ref[0].value) < 0.0001,
          `tool=${data.services[0].value} ref=${ref[0].value}`
        );
        check(
          "conversion top-1 paid+conv match ref",
          data.services[0].paidBookings === ref[0].paid && data.services[0].conversations === ref[0].conv,
          `tool=p${data.services[0].paidBookings}/c${data.services[0].conversations} ref=p${ref[0].paid}/c${ref[0].conv}`
        );
        const desc = data.services.every((s, i) => i === 0 ? true : s.value <= data.services[i - 1].value);
        check("conversion ranks descending", desc);
        const allHavePositiveConv = data.services.every((s) => s.conversations > 0);
        check("conversion: every ranked service has conversations > 0", allHavePositiveConv);
        const display = r.result.display as { columns: string[]; rows: Array<Array<string | number>> };
        check("conversion column header = 'Conversion'", display.columns[2] === "Conversion");
        const top1Fmt = String(display.rows[0][2]);
        check(
          "conversion top-1 display formatted as 'X.X% (paid/conv)'",
          /^\d+\.\d%\s\(\d+\/\d+\)$/.test(top1Fmt),
          top1Fmt
        );
      }
    }
  }

  // Shop-scoping defense
  console.log("\n=== Shop-scoping defense ===");
  {
    const fake: ToolContext = { shopId: "this-shop-does-not-exist-zzz", pool };
    const r = await dispatchTool(topServices, { by: "revenue", range: "all", limit: 5 }, fake);
    check("fake shop dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const d = r.result.data as { count: number };
      check("fake shop revenue → 0 services", d.count === 0);
    }
    const r2 = await dispatchTool(topServices, { by: "conversion", range: "all", limit: 5 }, fake);
    check("fake shop conversion dispatch ok", r2.ok === true);
    if (r2.ok && r2.result) {
      const d = r2.result.data as { count: number };
      check("fake shop conversion → 0 services", d.count === 0);
    }
  }

  // Bad args
  console.log("\n=== Bad args ===");
  {
    const r = await dispatchTool(topServices, { by: "profit", range: "all", limit: 5 }, ctx);
    check("bad by → ok=false", !r.ok && /must be one of/.test(r.error ?? ""), r.error ?? "");
  }
  {
    const r = await dispatchTool(topServices, { by: "revenue", range: "monthly", limit: 5 }, ctx);
    check("bad range → ok=false", !r.ok && /must be one of/.test(r.error ?? ""), r.error ?? "");
  }

  await pool.end();
  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
