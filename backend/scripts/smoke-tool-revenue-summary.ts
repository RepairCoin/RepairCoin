// Smoke test for Phase 2.1 — revenue_summary tool.
//
// Verifies against real DO data:
//   1. Tool dispatches via the dispatcher with valid args.
//   2. The 7d / 30d / 90d / all totals match a hand-computed reference
//      SQL run from this script (truth-vs-tool comparison).
//   3. compare='prior' returns a prior-window sum + delta.
//   4. Shop-scoping: invoking with a fake shopId returns $0.00, never
//      another shop's revenue.
//   5. Display payload shape matches ToolDisplay union.
//
// Run: npx ts-node scripts/smoke-tool-revenue-summary.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import { revenueSummary } from "../src/domains/AIAgentDomain/services/insights/tools/revenueSummary";
import { ToolContext } from "../src/domains/AIAgentDomain/services/insights/types";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(64)} ${detail}`);
  ok ? pass++ : fail++;
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

async function referenceSum(
  pool: Pool,
  shopId: string,
  days: number | null
): Promise<{ totalUsd: number; n: number }> {
  const conds: string[] = [
    `shop_id = $1`,
    `status IN ('paid', 'completed')`,
  ];
  const params: unknown[] = [shopId];
  if (days !== null) {
    params.push(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    conds.push(`created_at >= $${params.length}`);
  }
  const r = await pool.query<{ total: string; n: string }>(
    `SELECT COALESCE(SUM(total_amount), 0)::text AS total, COUNT(*)::text AS n
     FROM service_orders WHERE ${conds.join(" AND ")}`,
    params
  );
  return { totalUsd: Number(r.rows[0].total), n: Number(r.rows[0].n) };
}

async function referencePriorSum(
  pool: Pool,
  shopId: string,
  days: number
): Promise<{ totalUsd: number; n: number }> {
  const now = Date.now();
  const from = new Date(now - 2 * days * 24 * 60 * 60 * 1000);
  const to = new Date(now - days * 24 * 60 * 60 * 1000);
  const r = await pool.query<{ total: string; n: string }>(
    `SELECT COALESCE(SUM(total_amount), 0)::text AS total, COUNT(*)::text AS n
     FROM service_orders
     WHERE shop_id = $1 AND status IN ('paid', 'completed')
       AND created_at >= $2 AND created_at < $3`,
    [shopId, from, to]
  );
  return { totalUsd: Number(r.rows[0].total), n: Number(r.rows[0].n) };
}

async function main() {
  // Direct connection for reference math — matches the tool's pool
  // structurally (same host/db/user).
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
    console.log(`\n=== range='${range}' (single) ===`);
    const r = await dispatchTool(revenueSummary, { range }, ctx);
    check(`${range} dispatch ok`, r.ok === true, r.error ?? "");
    if (!r.ok || !r.result) continue;

    const data = r.result.data as {
      range: string;
      totalUsd: number;
      orderCount: number;
    };
    const display = r.result.display as {
      kind: string;
      primary: string;
      label: string;
      sub: string;
    };

    const days = range === "all" ? null : RANGE_DAYS[range];
    const ref = await referenceSum(pool, SHOP, days);

    check(
      `${range} totalUsd matches reference`,
      Math.abs(data.totalUsd - ref.totalUsd) < 0.001,
      `tool=${data.totalUsd} ref=${ref.totalUsd}`
    );
    check(
      `${range} orderCount matches reference`,
      data.orderCount === ref.n,
      `tool=${data.orderCount} ref=${ref.n}`
    );
    check(`${range} display.kind=number`, display.kind === "number");
    check(
      `${range} display.primary formatted USD`,
      /^\$[\d,]+\.\d{2}$/.test(display.primary),
      display.primary
    );
    check(
      `${range} display.label mentions window`,
      display.label.includes(range === "all" ? "all time" : range.replace("d", " days")),
      display.label
    );
    check(
      `${range} display.sub mentions orderCount`,
      display.sub.startsWith(`${data.orderCount} paid`),
      display.sub
    );
  }

  // Compare='prior' path for 7d.
  console.log("\n=== compare='prior' for 7d ===");
  {
    const r = await dispatchTool(
      revenueSummary,
      { range: "7d", compare: "prior" },
      ctx
    );
    check("dispatch ok", r.ok === true, r.error ?? "");
    if (r.ok && r.result) {
      const data = r.result.data as {
        current: { totalUsd: number; orderCount: number };
        prior: { totalUsd: number; orderCount: number };
        deltaPct: number | null;
      };
      const refCurrent = await referenceSum(pool, SHOP, 7);
      const refPrior = await referencePriorSum(pool, SHOP, 7);
      check(
        "current.totalUsd matches reference",
        Math.abs(data.current.totalUsd - refCurrent.totalUsd) < 0.001,
        `tool=${data.current.totalUsd} ref=${refCurrent.totalUsd}`
      );
      check(
        "prior.totalUsd matches reference",
        Math.abs(data.prior.totalUsd - refPrior.totalUsd) < 0.001,
        `tool=${data.prior.totalUsd} ref=${refPrior.totalUsd}`
      );
      const expectedDelta =
        refPrior.totalUsd === 0
          ? null
          : ((refCurrent.totalUsd - refPrior.totalUsd) / refPrior.totalUsd) * 100;
      check(
        "deltaPct matches reference",
        expectedDelta === null
          ? data.deltaPct === null
          : data.deltaPct !== null &&
              Math.abs((data.deltaPct as number) - (expectedDelta as number)) <
                0.001,
        `tool=${data.deltaPct} ref=${expectedDelta}`
      );
      const display = r.result.display as { kind: string; items: unknown[] };
      check("display.kind=list", display.kind === "list");
      check("display has 3 items (current, prior, Δ)", display.items.length === 3);
    }
  }

  // compare='prior' + range='all' → comparisonUnsupported flag.
  console.log("\n=== compare='prior' for 'all' (unsupported) ===");
  {
    const r = await dispatchTool(
      revenueSummary,
      { range: "all", compare: "prior" },
      ctx
    );
    check("dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const data = r.result.data as {
        comparisonUnsupported?: boolean;
        comparisonReason?: string;
      };
      check("comparisonUnsupported flag set", data.comparisonUnsupported === true);
      check(
        "comparisonReason populated",
        typeof data.comparisonReason === "string" &&
          data.comparisonReason.includes("not supported")
      );
    }
  }

  // Shop-scoping defense: fake shopId returns $0.00, never another shop's data.
  console.log("\n=== Shop-scoping defense ===");
  {
    const fakeCtx: ToolContext = { shopId: "this-shop-does-not-exist-zzz", pool };
    const r = await dispatchTool(revenueSummary, { range: "all" }, fakeCtx);
    check("fake shop dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const data = r.result.data as { totalUsd: number; orderCount: number };
      check("fake shop totalUsd === 0", data.totalUsd === 0, `got ${data.totalUsd}`);
      check("fake shop orderCount === 0", data.orderCount === 0, `got ${data.orderCount}`);
    }
  }

  await pool.end();
  console.log(
    `\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`
  );
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
