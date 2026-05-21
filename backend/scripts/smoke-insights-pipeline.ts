// Smoke test for Phase 3.3 — InsightsController full pipeline.
//
// Mocks AnthropicClient, SpendCapEnforcer, InsightsAuditLogger so the
// test is deterministic + offline. Uses a stub pool — tools that get
// invoked use their real execute(), so real PG calls would happen
// in the dispatch step. To keep this fully offline we use synthetic
// tool names + accept that the dispatcher will surface "Unknown tool"
// — which itself tests the unknown-tool branch — UNLESS we point to
// real tools. For tool dispatch happy-path coverage we run a small
// number of cases against the real DO pool.
//
// Branches covered:
//   - 0 tool calls (model wrote prose directly) → success
//   - 1 tool call (real tool, real pool) → roundtrip → success
//   - Multi tool calls in one Claude turn → both dispatched
//   - Iteration cap → loop terminates after MAX_TOOL_ITERATIONS
//   - Anthropic throws → 503 + audit row written
//   - Spend cap exhausted → 429, no Claude call, no audit row
//   - Unknown tool name from Claude → captured as ok:false in tool_calls
//
// Run: npx ts-node scripts/smoke-insights-pipeline.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { makeInsightsController } from "../src/domains/AIAgentDomain/controllers/InsightsController";
import { AnthropicClient } from "../src/domains/AIAgentDomain/services/AnthropicClient";
import { SpendCapEnforcer } from "../src/domains/AIAgentDomain/services/SpendCapEnforcer";
import { InsightsAuditLogger, InsightsAuditEntry } from "../src/domains/AIAgentDomain/services/InsightsAuditLogger";
import { AnthropicCallOptions, ClaudeResponse } from "../src/domains/AIAgentDomain/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(72)} ${detail}`);
  ok ? pass++ : fail++;
};

// -- Mocks --

type FakeResponse = {
  text: string;
  toolUses?: Array<{ toolName: string; toolUseId: string; input: Record<string, unknown> }>;
  cost?: number;
  latency?: number;
  cachedTokens?: number;
};

class MockAnthropic extends AnthropicClient {
  public calls: AnthropicCallOptions[] = [];
  private responses: FakeResponse[];
  private throwOn: Set<number>;
  constructor(responses: FakeResponse[], throwOn: number[] = []) {
    super("dummy-key-for-test"); // constructor accepts an apiKey override
    this.responses = responses;
    this.throwOn = new Set(throwOn);
  }
  async complete(options: AnthropicCallOptions): Promise<ClaudeResponse> {
    const idx = this.calls.length;
    this.calls.push(options);
    if (this.throwOn.has(idx)) {
      throw new Error(`mock anthropic failure on call ${idx}`);
    }
    const r = this.responses[idx] ?? this.responses[this.responses.length - 1];
    return {
      text: r.text,
      model: "claude-sonnet-4-6",
      stopReason: r.toolUses && r.toolUses.length > 0 ? "tool_use" : "end_turn",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: r.cachedTokens ?? 0,
      },
      costUsd: r.cost ?? 0.001,
      latencyMs: r.latency ?? 50,
      toolUses: r.toolUses ?? [],
    };
  }
}

class MockSpendCap extends SpendCapEnforcer {
  public allowed: boolean;
  public recorded: number[] = [];
  constructor(allowed = true) {
    super();
    this.allowed = allowed;
  }
  async canSpend(_shopId: string) {
    return {
      allowed: this.allowed,
      useCheaperModel: false,
      currentSpendUsd: this.allowed ? 5 : 100,
      monthlyBudgetUsd: 50,
      percentUsed: this.allowed ? 10 : 200,
      blockReason: this.allowed ? undefined : "cap reached",
    };
  }
  async recordSpend(_shopId: string, cost: number) {
    this.recorded.push(cost);
  }
}

class MockAudit extends InsightsAuditLogger {
  public entries: InsightsAuditEntry[] = [];
  constructor() {
    super();
  }
  async log(entry: InsightsAuditEntry): Promise<string | null> {
    this.entries.push(entry);
    return "fake-audit-id";
  }
}

type StubRes = { statusCode: number; body: any; status: (code: number) => StubRes; json: (p: any) => void };
function makeRes(): StubRes {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (p: any) => { r.body = p; };
  return r;
}
function makeReq(shopId: string, body: any): any {
  return { user: { shopId }, body };
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

  // ---- 1. Zero tool calls (Claude declines / answers from memory) ----
  console.log("=== 1. Zero tool calls ===");
  {
    const anthropic = new MockAnthropic([{ text: "Hi — I can answer business-data questions.", toolUses: [] }]);
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s1", messages: [{ role: "user", content: "hello" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 200", res.statusCode === 200);
    check("success true", res.body?.success === true);
    check("reply matches mock text", res.body?.data?.reply === "Hi — I can answer business-data questions.");
    check("toolCalls empty", Array.isArray(res.body?.data?.toolCalls) && res.body.data.toolCalls.length === 0);
    check("exactly 1 Claude call (no loop)", anthropic.calls.length === 1);
    check("audit row written", audit.entries.length === 1);
    check("audit costUsd === 0.001", audit.entries[0].costUsd === 0.001);
    check("audit toolCalls empty", audit.entries[0].toolCalls.length === 0);
    check("spend recorded", spendCap.recorded.length === 1);
  }

  // ---- 2. Single tool call → roundtrip → success (real tool, real pool) ----
  console.log("\n=== 2. Single tool call (real dispatch against DO) ===");
  {
    const anthropic = new MockAnthropic([
      {
        text: "",
        toolUses: [{
          toolName: "revenue_summary",
          toolUseId: "tu_1",
          input: { range: "all" },
        }],
      },
      { text: "Your shop made $7,783.02 all time across 23 paid+completed orders.", toolUses: [] },
    ]);
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s2", messages: [{ role: "user", content: "How much did I earn?" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 200", res.statusCode === 200, JSON.stringify(res.body));
    check("reply is the second-call text", res.body?.data?.reply.includes("$7,783"));
    check("toolCalls has 1 entry", res.body?.data?.toolCalls?.length === 1);
    check("toolCalls[0].tool === revenue_summary", res.body?.data?.toolCalls?.[0]?.tool === "revenue_summary");
    check("toolCalls[0].display.kind === number", res.body?.data?.toolCalls?.[0]?.display?.kind === "number");
    check("2 Claude calls (roundtrip)", anthropic.calls.length === 2);
    // Verify second call's messages include the tool_result block
    const secondCallMsgs = anthropic.calls[1].messages;
    const lastMsg = secondCallMsgs[secondCallMsgs.length - 1];
    check(
      "second call's last message is user with tool_result block",
      lastMsg.role === "user" &&
      Array.isArray(lastMsg.content) &&
      (lastMsg.content as any[]).some((b) => b.type === "tool_result")
    );
    check("audit toolCalls[0].tool", audit.entries[0].toolCalls[0]?.tool === "revenue_summary");
    check("audit toolCalls[0].args.range", (audit.entries[0].toolCalls[0]?.args as any)?.range === "all");
    check("audit costUsd is cumulative", audit.entries[0].costUsd === 0.002);
    check("audit cachedInputTokens === 0", audit.entries[0].cachedInputTokens === 0);
  }

  // ---- 3. Multi tool calls in one Claude turn ----
  console.log("\n=== 3. Multi tool calls in one Claude turn ===");
  {
    const anthropic = new MockAnthropic([
      {
        text: "",
        toolUses: [
          { toolName: "revenue_summary", toolUseId: "tu_a", input: { range: "30d" } },
          { toolName: "bookings_breakdown", toolUseId: "tu_b", input: { range: "30d" } },
        ],
      },
      { text: "Last 30d: $2,117 across 7 paid+completed orders; 13 total bookings.", toolUses: [] },
    ]);
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s3", messages: [{ role: "user", content: "revenue + bookings last 30d" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 200", res.statusCode === 200);
    check("toolCalls has 2 entries", res.body?.data?.toolCalls?.length === 2);
    check("audit toolCalls has 2 entries", audit.entries[0].toolCalls.length === 2);
    check(
      "audit toolCalls names",
      audit.entries[0].toolCalls[0].tool === "revenue_summary" &&
      audit.entries[0].toolCalls[1].tool === "bookings_breakdown"
    );
    // Each tool dispatched + each had a latency
    check(
      "each tool invocation has latencyMs",
      audit.entries[0].toolCalls.every((t) => typeof t.latencyMs === "number" && t.latencyMs >= 0)
    );
  }

  // ---- 4. Iteration cap (Claude keeps calling forever) ----
  console.log("\n=== 4. Iteration cap = 5 ===");
  {
    // Every response includes a tool_use → loop until cap.
    const inf: FakeResponse = {
      text: "",
      toolUses: [{ toolName: "revenue_summary", toolUseId: "tu_loop", input: { range: "7d" } }],
    };
    const anthropic = new MockAnthropic(Array(10).fill(inf));
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s4", messages: [{ role: "user", content: "loop" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    // Controller should stop after 5 iterations.
    check("Claude called exactly 5 times (MAX_TOOL_ITERATIONS)", anthropic.calls.length === 5, `actual=${anthropic.calls.length}`);
    check("audit row still written", audit.entries.length === 1);
    check("audit costUsd === 5 * 0.001", Math.abs(audit.entries[0].costUsd - 0.005) < 1e-9);
    check("audit toolCalls has 5 entries", audit.entries[0].toolCalls.length === 5);
    // After cap, lastResponse exists (the 5th call's response), so we return 200, not 503.
    check("status 200 (still has a response)", res.statusCode === 200);
  }

  // ---- 5. Anthropic throws → 503 + audit row ----
  console.log("\n=== 5. Anthropic failure → 503 + audit ===");
  {
    const anthropic = new MockAnthropic([{ text: "" }], /*throwOn*/ [0]);
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s5", messages: [{ role: "user", content: "hi" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 503", res.statusCode === 503, JSON.stringify(res.body));
    check("body success:false", res.body?.success === false);
    check("audit row written", audit.entries.length === 1);
    check("audit errorMessage populated", typeof audit.entries[0].errorMessage === "string" && audit.entries[0].errorMessage.length > 0);
    check("audit responsePayload null", audit.entries[0].responsePayload === null);
    check("audit latencyMs null", audit.entries[0].latencyMs === null);
    check("spend NOT recorded (no successful response)", spendCap.recorded.length === 0);
  }

  // ---- 6. Spend cap exhausted → 429 ----
  console.log("\n=== 6. Spend cap exhausted → 429 ===");
  {
    const anthropic = new MockAnthropic([{ text: "should not be called" }]);
    const spendCap = new MockSpendCap(/*allowed*/ false);
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s6", messages: [{ role: "user", content: "hi" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 429", res.statusCode === 429);
    check("Claude NOT called", anthropic.calls.length === 0);
    check("audit NOT written", audit.entries.length === 0);
    check("429 body has details.blockReason", res.body?.details?.blockReason === "cap reached");
  }

  // ---- 7. Unknown tool name from Claude ----
  console.log("\n=== 7. Unknown tool name from Claude → captured as error in tool_calls ===");
  {
    const anthropic = new MockAnthropic([
      { text: "", toolUses: [{ toolName: "frobnicate_widget", toolUseId: "tu_x", input: {} }] },
      { text: "Sorry, I couldn't get that.", toolUses: [] },
    ]);
    const spendCap = new MockSpendCap();
    const audit = new MockAudit();
    const ctrl = makeInsightsController({ anthropic, spendCap, auditLogger: audit, pool });
    const req = makeReq("peanut", { sessionId: "s7", messages: [{ role: "user", content: "frobnicate" }] });
    const res = makeRes();
    await ctrl.askInsights(req, res as any);
    check("status 200 (recoverable)", res.statusCode === 200, JSON.stringify(res.body));
    check("audit toolCalls has 1 entry", audit.entries[0].toolCalls.length === 1);
    check("entry tool name matches the bad name", audit.entries[0].toolCalls[0].tool === "frobnicate_widget");
    check(
      "entry has error mentioning Unknown tool",
      typeof audit.entries[0].toolCalls[0].error === "string" &&
      /Unknown tool/i.test(audit.entries[0].toolCalls[0].error!)
    );
    // Second-call payload should contain a tool_result with is_error:true
    const secondCallMsgs = anthropic.calls[1].messages;
    const lastMsg = secondCallMsgs[secondCallMsgs.length - 1];
    const resultBlock = Array.isArray(lastMsg.content)
      ? (lastMsg.content as any[]).find((b) => b.type === "tool_result")
      : null;
    check("second call carries is_error:true tool_result", resultBlock?.is_error === true);
  }

  await pool.end();
  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
