// backend/tests/ai-agent/PreviewController.test.ts
//
// Unit tests for the POST /api/ai/preview controller. All deps mocked — no
// real DB, no real Anthropic call. Verifies:
//   - Body validation (400 on missing serviceId)
//   - 404 when service or shop not found
//   - 403 when shop user is not the owner
//   - Admin can preview any service
//   - Cache hit returns cached: true on second call
//   - Custom sampleQuestion bypasses cache
//   - Tone resolution priority (body > service.aiTone > 'professional')
//   - 429 from Anthropic surfaces as 429 to client

// Mock the database pool used for shop lookup. Hoisted by jest.
const mockPoolQuery = jest.fn();
jest.mock("../../src/utils/database-pool", () => ({
  getSharedPool: () => ({ query: mockPoolQuery }),
}));

import {
  makePreviewAIReply,
  _clearPreviewCacheForTests,
} from "../../src/domains/AIAgentDomain/controllers/PreviewController";

function makeReq(opts: {
  body?: any;
  user?: { role?: string; shopId?: string };
}) {
  return {
    body: opts.body ?? {},
    user: opts.user ?? {},
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const baseService = {
  serviceId: "srv_test",
  shopId: "shop_test",
  serviceName: "Battery Replacement",
  description: "Quick battery swap",
  priceUsd: 49.99,
  durationMinutes: 30,
  category: "phone-repair",
  aiTone: "professional",
  aiCustomInstructions: null,
  aiBookingAssistance: false,
};

const baseClaudeResponse = {
  text: "Sure! It's $49.99 and takes about 30 minutes.",
  model: "claude-haiku-4-5-20251001",
  stopReason: "end_turn",
  usage: {
    inputTokens: 80,
    outputTokens: 40,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  },
  costUsd: 0.0002,
  latencyMs: 800,
};

function makeDeps(opts: {
  service?: any;
  shopRow?: any;
  claudeResponse?: any;
  claudeError?: any;
} = {}) {
  const service = opts.service !== undefined ? opts.service : baseService;
  const shopRow = opts.shopRow !== undefined
    ? opts.shopRow
    : { name: "Test Shop", category: "phone-repair" };

  const serviceRepo = {
    getServiceById: jest.fn().mockResolvedValue(service),
  };

  const anthropicClient = {
    complete: opts.claudeError
      ? jest.fn().mockRejectedValue(opts.claudeError)
      : jest.fn().mockResolvedValue(opts.claudeResponse ?? baseClaudeResponse),
  };

  // Pool query mock returns shopRow for shops lookup
  mockPoolQuery.mockReset();
  mockPoolQuery.mockImplementation((sql: string) => {
    if (sql.includes("FROM shops")) {
      return Promise.resolve({ rows: shopRow ? [shopRow] : [] });
    }
    return Promise.resolve({ rows: [] });
  });

  return {
    serviceRepo: serviceRepo as any,
    anthropicClient: anthropicClient as any,
  };
}

beforeEach(() => {
  _clearPreviewCacheForTests();
});

describe("PreviewController — validation", () => {
  it("returns 400 when serviceId is missing", async () => {
    const handler = makePreviewAIReply(makeDeps());
    const req = makeReq({ body: {}, user: { role: "shop", shopId: "shop_test" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "serviceId is required" })
    );
  });

  it("returns 404 when service is not found", async () => {
    const handler = makePreviewAIReply(makeDeps({ service: null }));
    const req = makeReq({
      body: { serviceId: "srv_missing" },
      user: { role: "shop", shopId: "shop_test" },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Service not found" })
    );
  });

  it("returns 404 when shop row is missing", async () => {
    const handler = makePreviewAIReply(makeDeps({ shopRow: null }));
    const req = makeReq({
      body: { serviceId: "srv_test" },
      user: { role: "shop", shopId: "shop_test" },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Shop not found for this service" })
    );
  });
});

describe("PreviewController — auth", () => {
  it("returns 403 when shop user does not own the service", async () => {
    const handler = makePreviewAIReply(makeDeps());
    const req = makeReq({
      body: { serviceId: "srv_test" },
      user: { role: "shop", shopId: "shop_OTHER" },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it("allows admin to preview any service", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    const req = makeReq({
      body: { serviceId: "srv_test" },
      user: { role: "admin" },
    });
    const res = makeRes();
    await handler(req, res);

    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ cached: false }),
      })
    );
  });

  it("allows owner shop to preview its own service", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    const req = makeReq({
      body: { serviceId: "srv_test" },
      user: { role: "shop", shopId: "shop_test" },
    });
    const res = makeRes();
    await handler(req, res);

    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reply: baseClaudeResponse.text,
          model: baseClaudeResponse.model,
          cached: false,
        }),
      })
    );
  });
});

describe("PreviewController — caching", () => {
  it("returns cached: true on a second call within 1 hour", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    const req = () =>
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      });

    const res1 = makeRes();
    await handler(req(), res1);
    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cached: false }),
      })
    );

    const res2 = makeRes();
    await handler(req(), res2);
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cached: true }),
      })
    );

    // Anthropic only called once — cache hit avoided the second call.
    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(1);
  });

  it("custom sampleQuestion bypasses cache (does not store, does not read)", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);

    // First call with custom sampleQuestion — should NOT write cache
    const res1 = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test", sampleQuestion: "Different question" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res1
    );

    // Second call with default question — should be cache MISS (cached: false),
    // not hit, because the custom question didn't populate the cache.
    const res2 = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res2
    );

    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cached: false }),
      })
    );
    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(2);
  });

  it("different tones cache independently", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);

    await handler(
      makeReq({
        body: { serviceId: "srv_test", tone: "friendly" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );
    await handler(
      makeReq({
        body: { serviceId: "srv_test", tone: "urgent" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    // Two different tones → two API calls
    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(2);

    // Repeating friendly should hit cache
    const res3 = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test", tone: "friendly" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res3
    );
    expect(res3.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cached: true }),
      })
    );
    expect(deps.anthropicClient.complete).toHaveBeenCalledTimes(2);
  });
});

describe("PreviewController — tone resolution", () => {
  it("uses body.tone when valid", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test", tone: "urgent" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const sysPrompt = deps.anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt.toLowerCase()).toMatch(/urgent|limited time|act fast|book now/);
  });

  it("falls back to service.aiTone when body.tone is absent", async () => {
    const deps = makeDeps({
      service: { ...baseService, aiTone: "friendly" },
    });
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const sysPrompt = deps.anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt.toLowerCase()).toMatch(/friendly|warm|casual/);
  });

  it("falls back to 'professional' when neither body nor service has tone", async () => {
    const deps = makeDeps({
      service: { ...baseService, aiTone: null },
    });
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const sysPrompt = deps.anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt.toLowerCase()).toMatch(/professional|polished|courteous/);
  });

  it("ignores invalid body.tone and falls back to service.aiTone", async () => {
    const deps = makeDeps({
      service: { ...baseService, aiTone: "friendly" },
    });
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test", tone: "garbage_tone" as any },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const sysPrompt = deps.anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt.toLowerCase()).toMatch(/friendly|warm|casual/);
  });
});

describe("PreviewController — Anthropic call options", () => {
  it("uses Haiku model with maxTokens=250", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const callArgs = deps.anthropicClient.complete.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
    expect(callArgs.maxTokens).toBe(250);
    expect(callArgs.systemPrompt[0].cache).toBe(true);
  });

  it("sends default sample question when none provided", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    const messages = deps.anthropicClient.complete.mock.calls[0][0].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toMatch(/cost|book/i);
  });

  it("uses provided sampleQuestion when given", async () => {
    const deps = makeDeps();
    const handler = makePreviewAIReply(deps);
    await handler(
      makeReq({
        body: { serviceId: "srv_test", sampleQuestion: "Custom question?" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      makeRes()
    );

    expect(deps.anthropicClient.complete.mock.calls[0][0].messages[0].content).toBe(
      "Custom question?"
    );
  });
});

describe("PreviewController — error handling", () => {
  it("returns 429 when Anthropic rate limit hit", async () => {
    const deps = makeDeps({
      claudeError: { status: 429, message: "rate limit" },
    });
    const handler = makePreviewAIReply(deps);
    const res = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/rate limit/i),
      })
    );
  });

  it("returns 500 on generic Anthropic error", async () => {
    const deps = makeDeps({
      claudeError: { status: 500, message: "internal error" },
    });
    const handler = makePreviewAIReply(deps);
    const res = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it("returns 500 on unexpected DB error", async () => {
    const deps = makeDeps();
    mockPoolQuery.mockReset();
    mockPoolQuery.mockRejectedValue(new Error("connection refused"));

    const handler = makePreviewAIReply(deps);
    const res = makeRes();
    await handler(
      makeReq({
        body: { serviceId: "srv_test" },
        user: { role: "shop", shopId: "shop_test" },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
