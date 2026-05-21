// Smoke test for the Phase 1.5 dispatchTool() helper.
//
// Exercises: valid args, missing required, bad enum value, bad type,
// integer out of min/max range, unknown field (additionalProperties:
// false), and the catch-around-execute wrapper.
//
// Run: npx ts-node scripts/smoke-insights-dispatcher.ts

import { dispatchTool } from "../src/domains/AIAgentDomain/services/insights/dispatcher";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolResult,
} from "../src/domains/AIAgentDomain/services/insights/types";
import { getInsightsToolByName } from "../src/domains/AIAgentDomain/services/insights/registry";

// Dummy ctx — execute() in the stubs throws before touching ctx.pool,
// so a null pool is fine for these smoke tests.
const ctx: ToolContext = { shopId: "shop-test", pool: null as never };

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(60)} ${detail}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  console.log("=== top_customers schema validation ===");
  const top = getInsightsToolByName("top_customers");
  if (!top) {
    check("registry returns top_customers", false);
    return;
  }

  // 1. Missing required field
  {
    const r = await dispatchTool(top, { range: "7d", by: "spend" }, ctx);
    check(
      "missing required 'limit' → ok=false",
      !r.ok && /missing required field 'limit'/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 2. Bad enum value
  {
    const r = await dispatchTool(
      top,
      { range: "lifetime", by: "spend", limit: 5 },
      ctx
    );
    check(
      "bad enum 'lifetime' → ok=false",
      !r.ok && /must be one of/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 3. Bad type for limit
  {
    const r = await dispatchTool(
      top,
      { range: "7d", by: "spend", limit: "five" },
      ctx
    );
    check(
      "bad type 'limit=string' → ok=false",
      !r.ok && /must be an integer/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 4. Integer out of maximum
  {
    const r = await dispatchTool(
      top,
      { range: "7d", by: "spend", limit: 99 },
      ctx
    );
    check(
      "limit=99 (>max 10) → ok=false",
      !r.ok && /must be <= 10/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 5. Integer out of minimum
  {
    const r = await dispatchTool(
      top,
      { range: "7d", by: "spend", limit: 0 },
      ctx
    );
    check(
      "limit=0 (<min 1) → ok=false",
      !r.ok && /must be >= 1/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 6. Unknown field (additionalProperties: false)
  {
    const r = await dispatchTool(
      top,
      { range: "7d", by: "spend", limit: 5, shopId: "evil" },
      ctx
    );
    check(
      "unknown field 'shopId' → ok=false",
      !r.ok && /unknown field 'shopId'/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 7. Non-object args
  {
    const r = await dispatchTool(top, "not an object", ctx);
    check(
      "args='string' → ok=false",
      !r.ok && /must be an object/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  // 8. Array args
  {
    const r = await dispatchTool(top, [1, 2, 3], ctx);
    check(
      "args=array → ok=false",
      !r.ok && /must be an object/.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  console.log("\n=== Catch-around-execute wrapper ===");

  // 9. Valid args reach execute(), which throws (Phase-1 stub) — dispatcher
  //    should catch it and return ok=false with the thrown message.
  {
    const r = await dispatchTool(
      top,
      { range: "7d", by: "spend", limit: 5 },
      ctx
    );
    check(
      "valid args + throwing execute → ok=false with caught msg",
      !r.ok && /not implemented yet/.test(r.error ?? ""),
      r.error ?? ""
    );
    check(
      "latencyMs is a number on caught error",
      typeof r.latencyMs === "number" && r.latencyMs >= 0,
      `latencyMs=${r.latencyMs}`
    );
    check("audit args reflect caller input", r.args.range === "7d");
  }

  // 10. Valid args + working execute() — confirm ok=true path round-trips.
  console.log("\n=== Happy path (synthetic working tool) ===");
  const fakeResult: ToolResult = {
    data: { hello: "world" },
    display: { kind: "number", primary: "$42" },
  };
  const happyTool: BusinessInsightsTool = {
    name: "happy_tool",
    description: "fake",
    inputSchema: {
      type: "object",
      properties: {
        range: { type: "string", enum: ["7d"] },
      },
      required: ["range"],
      additionalProperties: false,
    },
    async execute(): Promise<ToolResult> {
      return fakeResult;
    },
  };
  {
    const r = await dispatchTool(happyTool, { range: "7d" }, ctx);
    check("happy path → ok=true", r.ok === true);
    check("happy path returns the tool's result", r.result === fakeResult);
    check("happy path no error", r.error === undefined);
    check(
      "happy path captures latency",
      typeof r.latencyMs === "number" && r.latencyMs >= 0
    );
  }

  console.log(
    `\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`
  );
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
