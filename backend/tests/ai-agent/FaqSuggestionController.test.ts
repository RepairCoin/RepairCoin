// backend/tests/ai-agent/FaqSuggestionController.test.ts
//
// Verify POST /api/ai/services/:serviceId/faq-suggestions and the pure
// parseFaqSuggestions helper.

import {
  makeFaqSuggestionController,
  parseFaqSuggestions,
} from "../../src/domains/AIAgentDomain/controllers/FaqSuggestionController";

const makeReq = (opts: { user?: any; params?: any; body?: any } = {}) =>
  ({ user: opts.user ?? {}, params: opts.params ?? {}, body: opts.body ?? {} } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseService = (overrides: any = {}) => ({
  serviceId: "srv_1",
  shopId: "peanut",
  serviceName: "Newly Baker",
  description: "A hands-on baking session. Includes all ingredients.",
  priceUsd: 99,
  category: "food",
  durationMinutes: 90,
  ...overrides,
});

const claudeReply = (arr: any) => ({
  text: JSON.stringify(arr),
  model: "claude-haiku-4-5-20251001",
  stopReason: "end_turn",
  usage: { inputTokens: 300, outputTokens: 120, cacheReadInputTokens: 0 },
  costUsd: 0.0012,
  latencyMs: 900,
});

const makeDeps = (opts: {
  service?: any;
  existingFaq?: any[];
  spendAllowed?: boolean;
  claudeText?: string;
  claudeResult?: any;
  claudeError?: any;
} = {}) => {
  const serviceRepo = {
    getServiceById: jest
      .fn()
      .mockResolvedValue("service" in opts ? opts.service : baseService()),
  };
  const faqRepo = {
    getEntriesForService: jest.fn().mockResolvedValue(opts.existingFaq ?? []),
  };
  const anthropicClient = {
    complete: opts.claudeError
      ? jest.fn().mockRejectedValue(opts.claudeError)
      : jest.fn().mockResolvedValue(
          opts.claudeResult ??
            (opts.claudeText !== undefined
              ? { ...claudeReply([]), text: opts.claudeText }
              : claudeReply([
                  {
                    question: "What's included?",
                    answer: "All ingredients.",
                    answerHint: "List what's in the kit",
                  },
                  {
                    question: "Can I bring a friend?",
                    answer: "",
                    answerHint: "State your guest policy",
                  },
                ]))
        ),
  };
  const spendCapEnforcer = {
    canSpend: jest
      .fn()
      .mockResolvedValue({ allowed: opts.spendAllowed ?? true, useCheaperModel: false }),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };
  return { serviceRepo, faqRepo, anthropicClient, spendCapEnforcer };
};

// ----- parseFaqSuggestions -----

describe("parseFaqSuggestions", () => {
  it("parses a clean JSON array", () => {
    const r = parseFaqSuggestions(
      '[{"question":"Q1","answer":"A1","answerHint":"H1"},{"question":"Q2","answer":"","answerHint":"H2"}]'
    );
    expect(r).toEqual([
      { question: "Q1", answer: "A1", answerHint: "H1" },
      { question: "Q2", answer: "", answerHint: "H2" },
    ]);
  });

  it("extracts the array even when wrapped in markdown fences + prose", () => {
    const r = parseFaqSuggestions(
      'Here are the FAQs:\n```json\n[{"question":"Q","answer":"A","answerHint":"H"}]\n```\nHope that helps!'
    );
    expect(r).toEqual([{ question: "Q", answer: "A", answerHint: "H" }]);
  });

  it("defaults answerHint to empty string when the model omits it", () => {
    const r = parseFaqSuggestions('[{"question":"Q","answer":"A"}]');
    expect(r).toEqual([{ question: "Q", answer: "A", answerHint: "" }]);
  });

  it("length-bounds the answerHint", () => {
    const longHint = "x".repeat(500);
    const r = parseFaqSuggestions(
      JSON.stringify([{ question: "Q", answer: "", answerHint: longHint }])
    );
    expect(r[0].answerHint.length).toBeLessThanOrEqual(200);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseFaqSuggestions("[{not json}]")).toEqual([]);
    expect(parseFaqSuggestions("no array here")).toEqual([]);
    expect(parseFaqSuggestions("")).toEqual([]);
  });

  it("drops items with no question but keeps empty answers", () => {
    const r = parseFaqSuggestions(
      '[{"question":"","answer":"x"},{"question":"Good","answer":"","answerHint":"H"}]'
    );
    expect(r).toEqual([{ question: "Good", answer: "", answerHint: "H" }]);
  });

  it("caps the result at 6 suggestions", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      question: `Q${i}`,
      answer: "A",
    }));
    expect(parseFaqSuggestions(JSON.stringify(many))).toHaveLength(6);
  });

  it("returns [] when the JSON is an object, not an array", () => {
    expect(parseFaqSuggestions('{"question":"Q","answer":"A"}')).toEqual([]);
  });
});

// ----- the endpoint -----

describe("FaqSuggestionController", () => {
  it("returns 400 when no serviceId param", async () => {
    const handler = makeFaqSuggestionController(makeDeps() as any);
    const res = makeRes();
    await handler(makeReq({ user: { role: "shop", shopId: "peanut" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when the service does not exist", async () => {
    const handler = makeFaqSuggestionController(makeDeps({ service: null }) as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when the shop does not own the service", async () => {
    const handler = makeFaqSuggestionController(makeDeps() as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "other-shop" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows an admin for any service", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "admin" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("returns suggestions for the owning shop and records spend", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    // Passes a `ledger` entry: FAQ suggestions have no cost table of their own, so this is what
    // writes the ai_misc_usage row that makes the spend visible to ai_usage_events (the cap's source).
    expect(deps.spendCapEnforcer.recordSpend).toHaveBeenCalledWith(
      "peanut",
      0.0012,
      expect.objectContaining({ feature: "faq_suggestion", vendor: "anthropic" })
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        suggestions: [
          {
            question: "What's included?",
            answer: "All ingredients.",
            answerHint: "List what's in the kit",
          },
          {
            question: "Can I bring a friend?",
            answer: "",
            answerHint: "State your guest policy",
          },
        ],
        overBudget: false,
      },
    });
  });

  it("skips the Claude call and reports overBudget when the spend cap is hit", async () => {
    const deps = makeDeps({ spendAllowed: false });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(deps.anthropicClient.complete).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { suggestions: [], overBudget: true },
    });
  });

  it("filters out suggestions that duplicate an existing FAQ question", async () => {
    const deps = makeDeps({
      existingFaq: [{ question: "  what's INCLUDED?  " }],
    });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    const data = (res.json as jest.Mock).mock.calls[0][0].data;
    // "What's included?" is a case/space-insensitive dup → dropped.
    expect(data.suggestions).toEqual([
      {
        question: "Can I bring a friend?",
        answer: "",
        answerHint: "State your guest policy",
      },
    ]);
  });

  it("returns an empty list (not a 500) when Claude output is unparseable", async () => {
    const deps = makeDeps({ claudeText: "sorry, I can't help with that" });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { suggestions: [], overBudget: false },
    });
  });

  it("returns 500 when the Claude call throws", async () => {
    const deps = makeDeps({ claudeError: new Error("network down") });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ----- source material (Phase 2) -----

describe("FaqSuggestionController — pasted source material", () => {
  const promptOf = (deps: any): string =>
    deps.anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;

  it("includes pasted sourceText in the prompt sent to Claude", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        params: { serviceId: "srv_1" },
        body: { sourceText: "Kits include flour, eggs, and a recipe card." },
      }),
      res
    );
    const prompt = promptOf(deps);
    expect(prompt).toContain("ADDITIONAL SOURCE MATERIAL");
    expect(prompt).toContain("flour, eggs, and a recipe card");
  });

  it("omits the source block when no sourceText is provided", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(promptOf(deps)).not.toContain("ADDITIONAL SOURCE MATERIAL");
  });

  it("caps oversized sourceText at 4000 characters", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        params: { serviceId: "srv_1" },
        body: { sourceText: "x".repeat(9000) },
      }),
      res
    );
    const prompt = promptOf(deps);
    const xRuns: string[] = prompt.match(/x+/g) ?? [];
    const longestXRun = xRuns.reduce(
      (a, b) => (b.length > a.length ? b : a),
      ""
    );
    expect(longestXRun.length).toBe(4000);
  });

  it("prefers the live description override from the body over the saved one", async () => {
    const deps = makeDeps({
      service: baseService({ description: "OLD saved description" }),
    });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        params: { serviceId: "srv_1" },
        body: { description: "NEW unsaved description with extra detail" },
      }),
      res
    );
    const prompt = promptOf(deps);
    expect(prompt).toContain("NEW unsaved description with extra detail");
    expect(prompt).not.toContain("OLD saved description");
  });

  it("falls back to the saved description when no override is sent", async () => {
    const deps = makeDeps({
      service: baseService({ description: "Saved description text" }),
    });
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({ user: { role: "shop", shopId: "peanut" }, params: { serviceId: "srv_1" } }),
      res
    );
    expect(promptOf(deps)).toContain("Saved description text");
  });

  it("ignores a non-string sourceText", async () => {
    const deps = makeDeps();
    const handler = makeFaqSuggestionController(deps as any);
    const res = makeRes();
    await handler(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        params: { serviceId: "srv_1" },
        body: { sourceText: { not: "a string" } },
      }),
      res
    );
    expect(promptOf(deps)).not.toContain("ADDITIONAL SOURCE MATERIAL");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});
