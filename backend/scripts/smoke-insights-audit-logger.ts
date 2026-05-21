// Smoke test for Phase 1.6 InsightsAuditLogger.
//
// Verifies against the real DO database:
//   1. log() inserts and returns a UUID
//   2. all columns round-trip correctly (incl. tool_calls JSONB)
//   3. response_payload === null path works
//   4. log() never throws on bad input (returns null instead)
//
// Cleans up every row it inserts. Run:
//   npx ts-node scripts/smoke-insights-audit-logger.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import {
  InsightsAuditLogger,
  InsightsAuditEntry,
} from "../src/domains/AIAgentDomain/services/InsightsAuditLogger";
import { ToolInvocationRecord } from "../src/domains/AIAgentDomain/services/insights/types";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(60)} ${detail}`);
  if (ok) pass++;
  else fail++;
};

async function main() {
  // Pick a real shop for the FK.
  const probe = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await probe.connect();
  const shopPick = await probe.query<{ shop_id: string }>(
    `SELECT shop_id FROM shops LIMIT 1`
  );
  if (shopPick.rows.length === 0) {
    console.log("No shops in DB — skipping (need at least one row for FK).");
    await probe.end();
    return;
  }
  const realShopId = shopPick.rows[0].shop_id;
  console.log(`Using real shop_id='${realShopId}' for FK.\n`);

  const logger = new InsightsAuditLogger();
  const insertedIds: string[] = [];

  // 1. Happy path — populated tool_calls.
  console.log("=== Happy path with tool_calls ===");
  const toolCalls: ToolInvocationRecord[] = [
    {
      tool: "revenue_summary",
      args: { range: "7d" },
      display: { kind: "number", primary: "$1,234" },
      latencyMs: 42,
    },
    {
      tool: "top_customers",
      args: { range: "7d", by: "spend", limit: 5 },
      display: {
        kind: "table",
        columns: ["customer", "spend"],
        rows: [["alice", 100]],
      },
      latencyMs: 11,
    },
  ];
  const happyEntry: InsightsAuditEntry = {
    shopId: realShopId,
    sessionId: "smoke-session-1",
    requestPayload: { messages: [{ role: "user", content: "test" }] },
    responsePayload: { id: "msg_test", text: "hello" },
    model: "claude-sonnet-4-6",
    inputTokens: 100,
    outputTokens: 50,
    cachedInputTokens: 80,
    costUsd: 0.0012,
    toolCalls,
    latencyMs: 250,
    errorMessage: null,
  };
  const happyId = await logger.log(happyEntry);
  check("log() returns a uuid", typeof happyId === "string" && happyId.length > 0);
  if (happyId) insertedIds.push(happyId);

  if (happyId) {
    const row = await probe.query(
      `SELECT shop_id, session_id, request_payload, response_payload,
              model, input_tokens, output_tokens, cached_input_tokens,
              cost_usd, tool_calls, latency_ms, error_message
       FROM ai_insights_messages WHERE id = $1`,
      [happyId]
    );
    const r = row.rows[0];
    check("shop_id matches", r.shop_id === realShopId);
    check("session_id matches", r.session_id === "smoke-session-1");
    check("model matches", r.model === "claude-sonnet-4-6");
    check("input_tokens matches", r.input_tokens === 100);
    check("output_tokens matches", r.output_tokens === 50);
    check("cached_input_tokens matches", r.cached_input_tokens === 80);
    check("cost_usd matches", Number(r.cost_usd) === 0.0012);
    check("latency_ms matches", r.latency_ms === 250);
    check("error_message null", r.error_message === null);
    check(
      "request_payload round-trips",
      r.request_payload?.messages?.[0]?.content === "test"
    );
    check(
      "response_payload round-trips",
      r.response_payload?.text === "hello"
    );
    // tool_calls JSONB
    check("tool_calls is array", Array.isArray(r.tool_calls));
    check("tool_calls has 2 entries", r.tool_calls?.length === 2);
    check(
      "tool_calls[0].tool",
      r.tool_calls?.[0]?.tool === "revenue_summary"
    );
    check(
      "tool_calls[0].args.range",
      r.tool_calls?.[0]?.args?.range === "7d"
    );
    check(
      "tool_calls[0].display.kind",
      r.tool_calls?.[0]?.display?.kind === "number"
    );
    check(
      "tool_calls[0].latencyMs",
      r.tool_calls?.[0]?.latencyMs === 42
    );
    check(
      "tool_calls[1].args.by",
      r.tool_calls?.[1]?.args?.by === "spend"
    );
    check(
      "tool_calls[1].display.rows[0]",
      Array.isArray(r.tool_calls?.[1]?.display?.rows?.[0])
    );
  }

  // 2. Empty tool_calls (Claude declined).
  console.log("\n=== Empty tool_calls path ===");
  const emptyId = await logger.log({
    ...happyEntry,
    sessionId: "smoke-session-2",
    toolCalls: [],
  });
  if (emptyId) insertedIds.push(emptyId);
  check("log() with empty toolCalls returns uuid", !!emptyId);
  if (emptyId) {
    const r = await probe.query(
      `SELECT tool_calls FROM ai_insights_messages WHERE id = $1`,
      [emptyId]
    );
    check("empty tool_calls stored as []", Array.isArray(r.rows[0]?.tool_calls) && r.rows[0].tool_calls.length === 0);
  }

  // 3. Null response_payload (error case).
  console.log("\n=== Null response_payload path ===");
  const errorId = await logger.log({
    ...happyEntry,
    sessionId: "smoke-session-3",
    responsePayload: null,
    errorMessage: "anthropic timed out",
    latencyMs: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    costUsd: 0,
    toolCalls: [],
  });
  if (errorId) insertedIds.push(errorId);
  check("log() with null response_payload returns uuid", !!errorId);
  if (errorId) {
    const r = await probe.query(
      `SELECT response_payload, error_message, latency_ms FROM ai_insights_messages WHERE id = $1`,
      [errorId]
    );
    check("response_payload stored as null", r.rows[0]?.response_payload === null);
    check(
      "error_message stored",
      r.rows[0]?.error_message === "anthropic timed out"
    );
    check("latency_ms stored as null", r.rows[0]?.latency_ms === null);
  }

  // 4. Non-throwing on bad FK — should return null, not throw.
  console.log("\n=== Non-throwing on bad input ===");
  let threw = false;
  let badResult: string | null = "not-set" as never;
  try {
    badResult = await logger.log({
      ...happyEntry,
      shopId: "this-shop-does-not-exist-zzz",
      sessionId: "smoke-session-4",
      toolCalls: [],
    });
  } catch {
    threw = true;
  }
  check("log() does not throw on FK violation", !threw);
  check("log() returns null on FK violation", badResult === null);

  // Cleanup
  console.log("\n=== Cleanup ===");
  if (insertedIds.length > 0) {
    const del = await probe.query(
      `DELETE FROM ai_insights_messages WHERE id = ANY($1::uuid[])`,
      [insertedIds]
    );
    check(
      `deleted ${del.rowCount} smoke-test row(s)`,
      del.rowCount === insertedIds.length
    );
  }

  await probe.end();

  console.log(
    `\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`
  );
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
