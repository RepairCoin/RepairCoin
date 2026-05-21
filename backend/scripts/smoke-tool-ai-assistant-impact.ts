// Smoke test for Phase 2.5 — ai_assistant_impact tool.
//
// Strategy: call MetricsAggregator.aggregate() directly with the same
// inputs the tool uses, then compare every field. The tool MUST equal
// the aggregator (it's a wrapper) — any drift is a bug.
//
// Also verifies: shop-scoping (fake shop → zeroed metrics + likely
// belowThreshold), display shape, dispatcher-level bad args.
//
// Run: npx ts-node scripts/smoke-tool-ai-assistant-impact.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import { aiAssistantImpact } from "../src/domains/AIAgentDomain/services/insights/tools/aiAssistantImpact";
import { ToolContext } from "../src/domains/AIAgentDomain/services/insights/types";
import { MetricsAggregator } from "../src/domains/AIAgentDomain/services/MetricsAggregator";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(64)} ${detail}`);
  ok ? pass++ : fail++;
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

async function refBaseline(pool: Pool, shopId: string): Promise<number> {
  const r = await pool.query<{ human_reply_baseline_minutes: number | null }>(
    `SELECT human_reply_baseline_minutes FROM ai_shop_settings WHERE shop_id = $1`,
    [shopId]
  );
  if (r.rows.length === 0) return 240;
  return r.rows[0].human_reply_baseline_minutes ?? 240;
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
  const aggregator = new MetricsAggregator({ pool });
  const baseline = await refBaseline(pool, SHOP);
  console.log(`Using shop='${SHOP}', baselineMinutes=${baseline}\n`);

  for (const range of ["7d", "30d", "90d", "all"] as const) {
    console.log(`=== range='${range}' ===`);
    const r = await dispatchTool(aiAssistantImpact, { range }, ctx);
    check(`${range} dispatch ok`, r.ok === true, r.error ?? "");
    if (!r.ok || !r.result) continue;

    const data = r.result.data as {
      range: string;
      rangeLabel: string;
      baselineMinutes: number;
      sampleN: number;
      belowThreshold: boolean;
      belowThresholdReason: string | null;
      businessImpact: {
        aiConversations: number;
        bookingsGenerated: number;
        revenueGenerated: number;
        customersRecovered: number;
        responseTimeSavedHours: number;
      };
      performance: {
        conversionRate: number;
        avgResponseTimeSeconds: number;
        bookingsCreated: number;
      };
    };

    // Truth comparison: call aggregator with the same inputs.
    const windowStart =
      range === "all"
        ? null
        : new Date(Date.now() - RANGE_DAYS[range] * 86400000);
    const ref = await aggregator.aggregate({
      shopId: SHOP,
      windowStart,
      baselineMinutes: baseline,
    });

    check(`${range} sampleN matches`, data.sampleN === ref.sampleN, `tool=${data.sampleN} ref=${ref.sampleN}`);
    check(`${range} belowThreshold matches`, data.belowThreshold === ref.belowThreshold);
    check(`${range} baselineMinutes matches`, data.baselineMinutes === baseline);
    check(
      `${range} aiConversations matches`,
      data.businessImpact.aiConversations === ref.businessImpact.aiConversations,
      `tool=${data.businessImpact.aiConversations} ref=${ref.businessImpact.aiConversations}`
    );
    check(
      `${range} bookingsGenerated matches`,
      data.businessImpact.bookingsGenerated === ref.businessImpact.bookingsGenerated,
      `tool=${data.businessImpact.bookingsGenerated} ref=${ref.businessImpact.bookingsGenerated}`
    );
    check(
      `${range} revenueGenerated matches`,
      Math.abs(data.businessImpact.revenueGenerated - ref.businessImpact.revenueGenerated) < 0.001,
      `tool=${data.businessImpact.revenueGenerated} ref=${ref.businessImpact.revenueGenerated}`
    );
    check(
      `${range} customersRecovered matches`,
      data.businessImpact.customersRecovered === ref.businessImpact.customersRecovered
    );
    check(
      `${range} responseTimeSavedHours matches`,
      Math.abs(data.businessImpact.responseTimeSavedHours - ref.businessImpact.responseTimeSavedHours) < 0.001
    );
    check(
      `${range} conversionRate matches`,
      Math.abs(data.performance.conversionRate - ref.performance.conversionRate) < 0.0001
    );
    check(
      `${range} avgResponseTimeSeconds matches`,
      Math.abs(data.performance.avgResponseTimeSeconds - ref.performance.avgResponseTimeSeconds) < 0.001
    );
    check(
      `${range} belowThresholdReason populated iff belowThreshold`,
      data.belowThreshold ? typeof data.belowThresholdReason === "string" : data.belowThresholdReason === null
    );

    // Display shape
    const display = r.result.display as { kind: string; items: Array<{ label: string; value: string | number }> };
    check(`${range} display.kind=list`, display.kind === "list");
    check(`${range} display has at least 8 items`, display.items.length >= 8);
    check(`${range} display[0].label === 'Window'`, display.items[0].label === "Window");
    check(
      `${range} display[0].value matches range label`,
      display.items[0].value === data.rangeLabel
    );
    // Threshold warning appears as last item iff belowThreshold
    const lastItem = display.items[display.items.length - 1];
    if (data.belowThreshold) {
      check(`${range} display ends with low-sample warning`, lastItem.label.includes("Low sample"));
    } else {
      check(`${range} display does NOT end with low-sample warning`, !lastItem.label.includes("Low sample"));
    }
    console.log("");
  }

  // Shop-scoping defense — non-existent shop should return all zeros.
  console.log("=== Shop-scoping defense ===");
  {
    const fake: ToolContext = { shopId: "this-shop-does-not-exist-zzz", pool };
    const r = await dispatchTool(aiAssistantImpact, { range: "all" }, fake);
    check("fake shop dispatch ok", r.ok === true);
    if (r.ok && r.result) {
      const d = r.result.data as { sampleN: number; belowThreshold: boolean; businessImpact: { aiConversations: number; revenueGenerated: number } };
      check("fake shop sampleN = 0", d.sampleN === 0);
      check("fake shop belowThreshold = true", d.belowThreshold === true);
      check("fake shop aiConversations = 0", d.businessImpact.aiConversations === 0);
      check("fake shop revenueGenerated = 0", d.businessImpact.revenueGenerated === 0);
    }
  }

  // Bad args
  console.log("\n=== Bad args ===");
  {
    const r = await dispatchTool(aiAssistantImpact, { range: "lifetime" }, ctx);
    check("bad range → ok=false", !r.ok && /must be one of/.test(r.error ?? ""), r.error ?? "");
  }
  {
    const r = await dispatchTool(aiAssistantImpact, {}, ctx);
    check("missing range → ok=false", !r.ok && /missing required/.test(r.error ?? ""), r.error ?? "");
  }

  await pool.end();
  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
