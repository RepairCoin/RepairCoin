// Smoke test for Phase 3.2 — InsightsController validator + factory.
//
// Covers:
//   - parseInsightsRequest: happy path + ~13 rejection branches
//   - makeInsightsController returns a callable askInsights handler
//   - 401 when no shopId on req.user
//   - 400 when body invalid (validator integration)
//   - 501 when handler stub is reached (Phase 3.3 will replace)
//
// Run: npx ts-node scripts/smoke-insights-controller.ts

import {
  parseInsightsRequest,
  makeInsightsController,
  MAX_MESSAGES,
  MAX_CONTENT_CHARS,
  MAX_SESSION_ID_CHARS,
} from "../src/domains/AIAgentDomain/controllers/InsightsController";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(72)} ${detail}`);
  ok ? pass++ : fail++;
};

// Minimal Request/Response stubs we use to exercise the handler shape.
type StubRes = {
  statusCode: number;
  body: any;
  status(code: number): StubRes;
  json(payload: any): void;
};
function makeRes(): StubRes {
  const r: any = { statusCode: 200, body: null };
  r.status = (code: number) => { r.statusCode = code; return r; };
  r.json = (p: any) => { r.body = p; };
  return r;
}
function makeReq(opts: { shopId?: string; body?: any }): any {
  return {
    user: opts.shopId ? { shopId: opts.shopId } : undefined,
    body: opts.body,
  };
}

async function main() {
  console.log("=== parseInsightsRequest: happy path ===");
  {
    const r = parseInsightsRequest({
      sessionId: "sess-1",
      messages: [{ role: "user", content: "How much did I earn last week?" }],
    });
    check("single user message → ok", r.ok === true);
    check("returns the same messages back", r.value?.messages.length === 1);
    check("returns sessionId", r.value?.sessionId === "sess-1");
  }
  {
    const r = parseInsightsRequest({
      sessionId: "sess-1",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ],
    });
    check("3-message alternation u/a/u → ok", r.ok === true);
  }

  console.log("\n=== parseInsightsRequest: rejection branches ===");
  const cases: Array<{ name: string; body: any; mustContain: RegExp }> = [
    { name: "null body", body: null, mustContain: /body is required/ },
    { name: "non-object body", body: "string", mustContain: /body is required/ },
    {
      name: "missing sessionId",
      body: { messages: [{ role: "user", content: "x" }] },
      mustContain: /sessionId.*non-empty string/,
    },
    {
      name: "empty sessionId",
      body: { sessionId: "", messages: [{ role: "user", content: "x" }] },
      mustContain: /sessionId.*non-empty string/,
    },
    {
      name: "oversized sessionId",
      body: {
        sessionId: "x".repeat(MAX_SESSION_ID_CHARS + 1),
        messages: [{ role: "user", content: "x" }],
      },
      mustContain: new RegExp(`sessionId.*${MAX_SESSION_ID_CHARS}`),
    },
    {
      name: "missing messages",
      body: { sessionId: "s" },
      mustContain: /messages.*array/,
    },
    {
      name: "empty messages",
      body: { sessionId: "s", messages: [] },
      mustContain: /messages.*not be empty/,
    },
    {
      name: "messages over cap",
      body: {
        sessionId: "s",
        messages: Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: "x",
        })),
      },
      mustContain: new RegExp(`messages.*${MAX_MESSAGES}`),
    },
    {
      name: "bad role",
      body: {
        sessionId: "s",
        messages: [{ role: "system", content: "x" }],
      },
      mustContain: /role must be 'user' or 'assistant'/,
    },
    {
      name: "non-string content",
      body: {
        sessionId: "s",
        messages: [{ role: "user", content: 123 }],
      },
      mustContain: /content must be a non-empty string/,
    },
    {
      name: "empty content",
      body: {
        sessionId: "s",
        messages: [{ role: "user", content: "" }],
      },
      mustContain: /content must be a non-empty string/,
    },
    {
      name: "oversized content",
      body: {
        sessionId: "s",
        messages: [
          { role: "user", content: "x".repeat(MAX_CONTENT_CHARS + 1) },
        ],
      },
      mustContain: new RegExp(`content exceeds maximum of ${MAX_CONTENT_CHARS}`),
    },
    {
      name: "starts with assistant",
      body: {
        sessionId: "s",
        messages: [{ role: "assistant", content: "hi" }],
      },
      mustContain: /expected 'user'/,
    },
    {
      name: "two user in a row",
      body: {
        sessionId: "s",
        messages: [
          { role: "user", content: "Q1" },
          { role: "user", content: "Q2" },
        ],
      },
      mustContain: /expected 'assistant'/,
    },
    {
      name: "ends with assistant",
      body: {
        sessionId: "s",
        messages: [
          { role: "user", content: "Q1" },
          { role: "assistant", content: "A1" },
        ],
      },
      mustContain: /last message must be from `user`/,
    },
  ];
  for (const c of cases) {
    const r = parseInsightsRequest(c.body);
    check(
      c.name,
      r.ok === false && c.mustContain.test(r.error ?? ""),
      r.error ?? ""
    );
  }

  console.log("\n=== makeInsightsController: 401 / 400 / 501 handler stub ===");
  const controller = makeInsightsController();
  {
    const req = makeReq({ body: { sessionId: "s", messages: [{ role: "user", content: "x" }] } });
    const res = makeRes();
    await controller.askInsights(req as any, res as any);
    check("no shopId → 401", res.statusCode === 401, `body=${JSON.stringify(res.body)}`);
    check("401 body has success:false + error", res.body?.success === false && typeof res.body?.error === "string");
  }
  {
    const req = makeReq({ shopId: "peanut", body: { sessionId: "" } });
    const res = makeRes();
    await controller.askInsights(req as any, res as any);
    check("bad body → 400", res.statusCode === 400);
    check("400 surfaces validator error", /sessionId/.test(String(res.body?.error)));
  }
  // Phase-3.2 sentinel removed: the "valid req → 501 stub" assertions
  // were obsoleted when Phase 3.3 wired the real handler pipeline.
  // Full pipeline coverage with mocked Anthropic + spend-cap + audit
  // lives in scripts/smoke-insights-pipeline.ts (46/46).

  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
