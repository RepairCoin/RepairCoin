// backend/tests/ai-agent/insights/InsightsController.test.ts
//
// Covers the pure validator + the controller's branches: auth (401),
// validation (400), spend-cap skip (429), happy path with tool roundtrip
// (200 + audit + spend recorded), Claude failure (503 + audit), and
// iteration cap. Real Claude / spend / audit are injected as mocks via
// the factory. Companion smoke script lives at
// backend/scripts/smoke-insights-pipeline.ts (real-DB tool dispatch).

import {
  makeInsightsController,
  parseInsightsRequest,
  MAX_MESSAGES,
  MAX_CONTENT_CHARS,
  MAX_SESSION_ID_CHARS,
} from "../../../src/domains/AIAgentDomain/controllers/InsightsController";
import type { Pool } from "pg";

const makeReq = (opts: { user?: any; body?: any } = {}) =>
  ({ user: opts.user ?? {}, body: opts.body } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const goodBody = (overrides: any = {}) => ({
  sessionId: "session-abc",
  messages: [{ role: "user", content: "How much did I earn last week?" }],
  ...overrides,
});

const makeSpendCap = (allowed: boolean = true): any => ({
  canSpend: jest.fn().mockResolvedValue({
    allowed,
    useCheaperModel: false,
    currentSpendUsd: allowed ? 0 : 100,
    monthlyBudgetUsd: 50,
    percentUsed: allowed ? 0 : 200,
    blockReason: allowed ? undefined : "cap reached",
  }),
  recordSpend: jest.fn().mockResolvedValue(undefined),
});

const makeAuditLogger = (): any => ({
  log: jest.fn().mockResolvedValue("audit-id-xyz"),
});

const claudeResponse = (overrides: any = {}) => ({
  text: "Your revenue last week was $2,117.",
  model: "claude-sonnet-4-6",
  stopReason: "end_turn",
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  },
  costUsd: 0.001,
  latencyMs: 200,
  toolUses: [],
  ...overrides,
});

// Mock pool — only used by the dispatcher path when Claude calls a tool.
// For the no-tool paths we still need a Pool reference (controller passes
// it as ctx.pool) but never actually queries.
const stubPool = (rowsByQuery: Array<Array<any>> = []) => {
  const remaining = [...rowsByQuery];
  const query = jest.fn(() =>
    Promise.resolve({ rows: remaining.shift() ?? [] })
  );
  return { query } as unknown as Pool;
};

// ----- parseInsightsRequest -----

describe("parseInsightsRequest", () => {
  it("accepts a minimal single-message valid request", () => {
    const r = parseInsightsRequest(goodBody());
    expect(r.ok).toBe(true);
    expect(r.value?.sessionId).toBe("session-abc");
    expect(r.value?.messages).toHaveLength(1);
  });

  it("accepts a 3-message multi-turn conversation", () => {
    const r = parseInsightsRequest({
      sessionId: "x",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects null / non-object body", () => {
    expect(parseInsightsRequest(null).ok).toBe(false);
    expect(parseInsightsRequest("nope").ok).toBe(false);
    expect(parseInsightsRequest(123).ok).toBe(false);
  });

  it("rejects missing / empty / oversized sessionId", () => {
    expect(parseInsightsRequest({ messages: [] }).error).toMatch(/sessionId/);
    expect(parseInsightsRequest({ sessionId: "", messages: [] }).error).toMatch(
      /sessionId/
    );
    expect(
      parseInsightsRequest({
        sessionId: "x".repeat(MAX_SESSION_ID_CHARS + 1),
        messages: [{ role: "user", content: "a" }],
      }).error
    ).toMatch(new RegExp(`sessionId.*${MAX_SESSION_ID_CHARS}`));
  });

  it("rejects missing / empty / over-cap messages", () => {
    expect(parseInsightsRequest({ sessionId: "s" }).error).toMatch(
      /messages.*array/
    );
    expect(
      parseInsightsRequest({ sessionId: "s", messages: [] }).error
    ).toMatch(/messages.*not be empty/);
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: "x",
        })),
      }).error
    ).toMatch(new RegExp(`messages.*${MAX_MESSAGES}`));
  });

  it("rejects bad role, non-string content, oversized content", () => {
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [{ role: "system", content: "x" }],
      }).error
    ).toMatch(/role must be/);
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [{ role: "user", content: 123 }],
      }).error
    ).toMatch(/content.*non-empty string/);
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [
          { role: "user", content: "x".repeat(MAX_CONTENT_CHARS + 1) },
        ],
      }).error
    ).toMatch(new RegExp(`content exceeds.*${MAX_CONTENT_CHARS}`));
  });

  it("rejects bad alternation (starts assistant, two users in a row, ends assistant)", () => {
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [{ role: "assistant", content: "hi" }],
      }).error
    ).toMatch(/expected 'user'/);
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [
          { role: "user", content: "Q1" },
          { role: "user", content: "Q2" },
        ],
      }).error
    ).toMatch(/expected 'assistant'/);
    expect(
      parseInsightsRequest({
        sessionId: "s",
        messages: [
          { role: "user", content: "Q1" },
          { role: "assistant", content: "A1" },
        ],
      }).error
    ).toMatch(/last message must be from `user`/);
  });
});

// ----- Controller branches -----

describe("InsightsController.askInsights", () => {
  it("401 when no shopId on req.user", async () => {
    const ctrl = makeInsightsController({
      anthropic: { complete: jest.fn() } as any,
      spendCap: makeSpendCap(),
      auditLogger: makeAuditLogger(),
      pool: stubPool(),
    });
    const req = makeReq({ body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Shop ID required" })
    );
  });

  it("400 with the validator's error message on bad body", async () => {
    const ctrl = makeInsightsController({
      anthropic: { complete: jest.fn() } as any,
      spendCap: makeSpendCap(),
      auditLogger: makeAuditLogger(),
      pool: stubPool(),
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: { sessionId: "" } });
    const res = makeRes();
    await ctrl.askInsights(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/sessionId/),
      })
    );
  });

  it("429 when spend cap exhausted — no Claude call, no audit row", async () => {
    const anthropic = { complete: jest.fn() } as any;
    const spendCap = makeSpendCap(false);
    const audit = makeAuditLogger();
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool: stubPool(),
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        details: expect.objectContaining({ blockReason: "cap reached" }),
      })
    );
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("happy path: zero tool calls → 1 Claude call, audit + spend recorded", async () => {
    const anthropic = {
      complete: jest.fn().mockResolvedValue(claudeResponse({ toolUses: [] })),
    } as any;
    const spendCap = makeSpendCap();
    const audit = makeAuditLogger();
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool: stubPool(),
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);
    expect(res.status).not.toHaveBeenCalled(); // success path uses .json directly
    expect(anthropic.complete).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "peanut",
        sessionId: "session-abc",
        costUsd: 0.001,
        toolCalls: [],
        errorMessage: null,
      })
    );
    expect(spendCap.recordSpend).toHaveBeenCalledWith("peanut", 0.001);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reply: expect.stringContaining("$2,117"),
          toolCalls: [],
        }),
      })
    );
  });

  it("happy path with tool roundtrip: 2 Claude calls, tool_calls populated in audit", async () => {
    const anthropic = {
      complete: jest
        .fn()
        // Round 1: Claude picks revenue_summary.
        .mockResolvedValueOnce(
          claudeResponse({
            text: "",
            toolUses: [
              {
                toolName: "revenue_summary",
                toolUseId: "tu_1",
                input: { range: "7d" },
              },
            ],
          })
        )
        // Round 2: Claude writes the final prose.
        .mockResolvedValueOnce(
          claudeResponse({
            text: "You earned $2,117.00 last week.",
            toolUses: [],
          })
        ),
    } as any;
    const spendCap = makeSpendCap();
    const audit = makeAuditLogger();
    // Pool will be queried by the real revenue_summary tool dispatch.
    // Return a canned shape that matches what its SQL expects.
    const pool = stubPool([[{ total: "2117.00", n: "7" }]]);
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool,
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);

    expect(anthropic.complete).toHaveBeenCalledTimes(2);
    // Audit row carries the tool invocation.
    const auditEntry = audit.log.mock.calls[0][0];
    expect(auditEntry.toolCalls).toHaveLength(1);
    expect(auditEntry.toolCalls[0]).toMatchObject({
      tool: "revenue_summary",
      args: { range: "7d" },
      display: { kind: "number" },
    });
    // costUsd is cumulative across both calls.
    expect(auditEntry.costUsd).toBeCloseTo(0.002, 5);
    // Response surfaces both tool + display to the frontend.
    const resBody = res.json.mock.calls[0][0];
    expect(resBody.data.toolCalls).toHaveLength(1);
    expect(resBody.data.toolCalls[0]).toMatchObject({
      tool: "revenue_summary",
      display: { kind: "number" },
    });
  });

  it("503 on Claude failure — audit row written, spend NOT recorded", async () => {
    const anthropic = {
      complete: jest.fn().mockRejectedValue(new Error("anthropic down")),
    } as any;
    const spendCap = makeSpendCap();
    const audit = makeAuditLogger();
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool: stubPool(),
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(audit.log).toHaveBeenCalledTimes(1);
    const auditEntry = audit.log.mock.calls[0][0];
    expect(auditEntry.errorMessage).toMatch(/anthropic down/);
    expect(auditEntry.responsePayload).toBeNull();
    expect(auditEntry.latencyMs).toBeNull();
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("iteration cap halts the agent loop after 5 rounds", async () => {
    const looper = claudeResponse({
      text: "",
      toolUses: [
        {
          toolName: "revenue_summary",
          toolUseId: "tu_loop",
          input: { range: "7d" },
        },
      ],
    });
    const anthropic = {
      complete: jest.fn().mockResolvedValue(looper),
    } as any;
    const spendCap = makeSpendCap();
    const audit = makeAuditLogger();
    // 5 successful dispatches will need 5 mock rows.
    const pool = stubPool(
      Array.from({ length: 5 }, () => [{ total: "100.00", n: "1" }])
    );
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool,
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);

    expect(anthropic.complete).toHaveBeenCalledTimes(5);
    const auditEntry = audit.log.mock.calls[0][0];
    expect(auditEntry.toolCalls).toHaveLength(5);
  });

  it("unknown tool name from Claude is captured non-throwingly in tool_calls", async () => {
    const anthropic = {
      complete: jest
        .fn()
        .mockResolvedValueOnce(
          claudeResponse({
            text: "",
            toolUses: [
              {
                toolName: "frobnicate_widget",
                toolUseId: "tu_x",
                input: {},
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          claudeResponse({ text: "Sorry, can't do that.", toolUses: [] })
        ),
    } as any;
    const spendCap = makeSpendCap();
    const audit = makeAuditLogger();
    const ctrl = makeInsightsController({
      anthropic,
      spendCap,
      auditLogger: audit,
      pool: stubPool(),
    });
    const req = makeReq({ user: { shopId: "peanut" }, body: goodBody() });
    const res = makeRes();
    await ctrl.askInsights(req, res);

    expect(res.status).not.toHaveBeenCalled(); // recoverable, returns 200
    const auditEntry = audit.log.mock.calls[0][0];
    expect(auditEntry.toolCalls[0]).toMatchObject({
      tool: "frobnicate_widget",
      error: expect.stringMatching(/Unknown tool/i),
    });
  });
});
