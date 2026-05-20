// backend/tests/ai-agent/HelpAssistantController.test.ts
//
// Covers the pure validator + the controller's branches: auth (401),
// validation (400), spend-cap skip path (429 without Claude call),
// happy path (audit + record spend + 200), Claude failure (503 still
// audited), cache flag mapping.
//
// Real Claude calls and audit DB writes are not exercised here —
// dependencies are injected as mocks via the factory.

import {
  makeHelpAssistantController,
  parseHelpRequest,
  MAX_MESSAGES,
  MAX_CONTENT_CHARS,
  MAX_SESSION_ID_CHARS,
} from "../../src/domains/AIAgentDomain/controllers/HelpAssistantController";

// ----- Test doubles -----

const makeReq = (opts: { user?: any; body?: any } = {}) =>
  ({ user: opts.user ?? {}, body: opts.body } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const fakeCorpusBlock = "--- ARTICLE: test.md ---\n\n# Test article\n";

const makeLoader = (block: string = fakeCorpusBlock): any => ({
  getCorpusBlock: () => block,
  getCorpusStats: () => ({
    articleCount: 1,
    byteCount: block.length,
    approxTokens: Math.ceil(block.length / 4),
    filenames: ["test.md"],
  }),
});

const makeSpendCap = (allowed: boolean = true, overrides: any = {}): any => ({
  canSpend: jest.fn().mockResolvedValue({
    allowed,
    useCheaperModel: false,
    currentSpendUsd: 0,
    monthlyBudgetUsd: 20,
    percentUsed: 0,
    ...overrides,
  }),
  recordSpend: jest.fn().mockResolvedValue(undefined),
});

const makeAnthropic = (overrides: any = {}): any => ({
  complete: jest.fn().mockResolvedValue({
    text: "Sample reply",
    model: "claude-haiku-4-5-20251001",
    stopReason: "end_turn",
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    costUsd: 0.001,
    latencyMs: 500,
    toolUses: [],
    ...overrides,
  }),
});

const makeAuditLogger = (): any => ({
  log: jest.fn().mockResolvedValue("audit-id-123"),
});

const goodBody = (overrides: any = {}) => ({
  sessionId: "session-123",
  messages: [{ role: "user", content: "How do I create a service?" }],
  ...overrides,
});

// ----- parseHelpRequest -----

describe("parseHelpRequest", () => {
  it("accepts a minimal single-message valid request", () => {
    const r = parseHelpRequest(goodBody());
    expect(r.ok).toBe(true);
    expect(r.value?.sessionId).toBe("session-123");
    expect(r.value?.messages).toHaveLength(1);
  });

  it("accepts a 3-message multi-turn conversation", () => {
    const r = parseHelpRequest({
      sessionId: "x",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(parseHelpRequest(null).ok).toBe(false);
    expect(parseHelpRequest("nope").ok).toBe(false);
    expect(parseHelpRequest(123).ok).toBe(false);
  });

  it("rejects missing or empty sessionId", () => {
    const r1 = parseHelpRequest({
      messages: [{ role: "user", content: "x" }],
    });
    expect(r1.ok).toBe(false);
    expect(r1.error).toMatch(/sessionId/);

    const r2 = parseHelpRequest({
      sessionId: "",
      messages: [{ role: "user", content: "x" }],
    });
    expect(r2.ok).toBe(false);
  });

  it("rejects oversized sessionId", () => {
    const r = parseHelpRequest({
      sessionId: "x".repeat(MAX_SESSION_ID_CHARS + 1),
      messages: [{ role: "user", content: "x" }],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/sessionId/);
  });

  it("rejects an empty messages array", () => {
    const r = parseHelpRequest({ sessionId: "x", messages: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/messages.*not be empty/);
  });

  it("rejects > MAX_MESSAGES", () => {
    // Build an alternating thread of MAX_MESSAGES+1 messages.
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    // Force odd length / last is user. With MAX_MESSAGES=20 (even),
    // MAX_MESSAGES+1=21 is odd → last is user → alternation passes.
    const r = parseHelpRequest({ sessionId: "x", messages });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/exceeds maximum/);
  });

  it("rejects content longer than MAX_CONTENT_CHARS", () => {
    const r = parseHelpRequest({
      sessionId: "x",
      messages: [{ role: "user", content: "a".repeat(MAX_CONTENT_CHARS + 1) }],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/exceeds maximum.*characters/);
  });

  it("rejects role values not in {user, assistant}", () => {
    const r = parseHelpRequest({
      sessionId: "x",
      messages: [{ role: "system", content: "hi" }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty content", () => {
    const r = parseHelpRequest({
      sessionId: "x",
      messages: [{ role: "user", content: "" }],
    });
    expect(r.ok).toBe(false);
  });

  it("enforces strict alternation starting with user", () => {
    const r1 = parseHelpRequest({
      sessionId: "x",
      messages: [{ role: "assistant", content: "you start?" }],
    });
    expect(r1.ok).toBe(false);
    expect(r1.error).toMatch(/alternation/);

    const r2 = parseHelpRequest({
      sessionId: "x",
      messages: [
        { role: "user", content: "Q1" },
        { role: "user", content: "Q2 — should have been assistant" },
      ],
    });
    expect(r2.ok).toBe(false);
    expect(r2.error).toMatch(/alternation/);
  });

  it("requires the last message to be from user (rejects even-length conversation)", () => {
    const r = parseHelpRequest({
      sessionId: "x",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/last message must be/i);
  });
});

// ----- Controller behavior -----

describe("HelpAssistantController.askHelp", () => {
  it("returns 401 when no shopId on the request", async () => {
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap: makeSpendCap(),
      anthropic: makeAnthropic(),
      auditLogger: makeAuditLogger(),
    });
    const res = makeRes();
    await controller.askHelp(makeReq({ body: goodBody() }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 on an invalid request body", async () => {
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap: makeSpendCap(),
      anthropic: makeAnthropic(),
      auditLogger: makeAuditLogger(),
    });
    const res = makeRes();
    await controller.askHelp(
      makeReq({
        user: { shopId: "shop1" },
        body: { sessionId: "x", messages: [] },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 429 + skips Claude when spend cap is exhausted", async () => {
    const spendCap = makeSpendCap(false, {
      blockReason: "monthly_budget_exceeded",
      currentSpendUsd: 25,
      monthlyBudgetUsd: 20,
      percentUsed: 1.25,
    });
    const anthropic = makeAnthropic();
    const auditLogger = makeAuditLogger();
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap,
      anthropic,
      auditLogger,
    });
    const res = makeRes();
    await controller.askHelp(
      makeReq({ user: { shopId: "shop1" }, body: goodBody() }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(429);
    // Critical: no Claude call, no audit row, no spend recorded.
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("happy path: returns 200 with reply shape, audits the call, records spend", async () => {
    const spendCap = makeSpendCap();
    const anthropic = makeAnthropic();
    const auditLogger = makeAuditLogger();
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap,
      anthropic,
      auditLogger,
    });
    const res = makeRes();
    await controller.askHelp(
      makeReq({ user: { shopId: "shop1" }, body: goodBody() }),
      res
    );

    expect(anthropic.complete).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop1",
        sessionId: "session-123",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 0,
        costUsd: 0.001,
        latencyMs: 500,
        errorMessage: null,
      })
    );
    expect(spendCap.recordSpend).toHaveBeenCalledWith("shop1", 0.001);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        reply: "Sample reply",
        model: "claude-haiku-4-5-20251001",
        cached: false,
        latencyMs: 500,
      }),
    });
  });

  it("marks system prompt with cache: true so Anthropic prompt cache kicks in", async () => {
    const anthropic = makeAnthropic();
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap: makeSpendCap(),
      anthropic,
      auditLogger: makeAuditLogger(),
    });
    await controller.askHelp(
      makeReq({ user: { shopId: "shop1" }, body: goodBody() }),
      makeRes()
    );
    expect(anthropic.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: [expect.objectContaining({ cache: true })],
      })
    );
  });

  it("returns 503 + still audits the failure when Claude throws", async () => {
    const anthropic = {
      complete: jest
        .fn()
        .mockRejectedValue(new Error("anthropic rate limit hit")),
    } as any;
    const auditLogger = makeAuditLogger();
    const spendCap = makeSpendCap();
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap,
      anthropic,
      auditLogger,
    });
    const res = makeRes();
    await controller.askHelp(
      makeReq({ user: { shopId: "shop1" }, body: goodBody() }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(503);
    // Audit row still gets written — we need a record of the failure.
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayload: null,
        errorMessage: expect.stringMatching(/rate limit hit/),
        costUsd: 0,
        latencyMs: null,
      })
    );
    // No spend recorded for a failed call.
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("sets cached: true on the response when the cache produced read hits", async () => {
    const anthropic = makeAnthropic({
      usage: {
        inputTokens: 50,
        outputTokens: 30,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 200,
      },
    });
    const controller = makeHelpAssistantController({
      corpusLoader: makeLoader(),
      spendCap: makeSpendCap(),
      anthropic,
      auditLogger: makeAuditLogger(),
    });
    const res = makeRes();
    await controller.askHelp(
      makeReq({ user: { shopId: "shop1" }, body: goodBody() }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ cached: true }),
    });
  });
});
