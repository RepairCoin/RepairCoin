// backend/tests/ai-agent/OrderConfirmationHandler.test.ts
//
// Phase 3 Task 11 — verify the order-completion AI confirmation hook fires
// (and skips) under the right conditions.

import { OrderConfirmationHandler } from "../../src/domains/AIAgentDomain/services/OrderConfirmationHandler";

// ----- Helpers -----

const samplePayload = (overrides: any = {}) => ({
  orderId: "ord_xxx",
  customerAddress: "0xabc",
  shopId: "shop_test",
  serviceId: "srv_xxx",
  totalAmount: 99,
  completedAt: new Date(),
  ...overrides,
});

const sampleEvent = (payload: any = samplePayload()) => ({
  type: "service.order_completed",
  aggregateId: payload.customerAddress,
  data: payload,
  timestamp: new Date(),
  source: "ServiceDomain",
  version: 1,
});

interface MockOpts {
  conversation?: { conversationId: string } | null;
  hasPriorAi?: boolean;
  shopAiGlobalEnabled?: boolean;
  spendAllowed?: boolean;
  order?: any;
  shop?: any;
  customer?: any;
  timezone?: string | null;
  claudeText?: string;
  claudeError?: any;
}

const makeMocks = (opts: MockOpts = {}) => {
  // Use `in` check (not ??) so explicit null is honored. ?? would fall
  // through null to the default, which makes "skips when no conversation"
  // tests false-pass.
  const conv =
    "conversation" in opts ? opts.conversation : { conversationId: "conv_xxx" };
  const hasPriorAi = opts.hasPriorAi ?? true;
  const shopAiGlobalEnabled = opts.shopAiGlobalEnabled ?? true;
  const spendAllowed = opts.spendAllowed ?? true;

  // pool.query handles 4 different queries in this code:
  //   1. find conversation
  //   2. has-prior-ai check
  //   3. ai_shop_settings.ai_global_enabled
  //   4. shop_time_slot_config.timezone
  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM conversations")) {
        return Promise.resolve({
          rows: conv ? [{ conversation_id: conv.conversationId }] : [],
        });
      }
      if (sql.includes("EXISTS")) {
        return Promise.resolve({ rows: [{ exists: hasPriorAi }] });
      }
      if (sql.includes("ai_shop_settings")) {
        return Promise.resolve({
          rows: [{ ai_global_enabled: shopAiGlobalEnabled }],
        });
      }
      if (sql.includes("shop_time_slot_config")) {
        return Promise.resolve({
          rows: [{ timezone: opts.timezone ?? "America/New_York" }],
        });
      }
      return Promise.resolve({ rows: [] });
    }),
  };

  const messageRepo = {
    createMessage: jest.fn().mockResolvedValue({
      message: { messageId: "msg_xxx" },
      created: true,
    }),
  };

  // Use a sentinel so passing `order: null` explicitly resolves to null,
  // not the default. ?? would coalesce null to default which is wrong here.
  const orderResolved =
    "order" in opts
      ? opts.order
      : {
          orderId: "ord_xxx",
          bookingDate: new Date("2026-05-08"),
          bookingTime: "14:30",
        };
  const orderRepo = {
    getOrderById: jest.fn().mockResolvedValue(orderResolved),
  };

  const shopRepo = {
    getShop: jest.fn().mockResolvedValue(opts.shop ?? { name: "Peanut" }),
  };

  const customerRepo = {
    getCustomer: jest
      .fn()
      .mockResolvedValue(opts.customer ?? { name: "Lee Ann" }),
  };

  const anthropicClient = {
    complete: opts.claudeError
      ? jest.fn().mockRejectedValue(opts.claudeError)
      : jest.fn().mockResolvedValue({
          text: opts.claudeText ?? "Thanks Lee Ann — see you next time!",
          model: "claude-haiku-4-5-20251001",
          stopReason: "end_turn",
          usage: {
            inputTokens: 80,
            outputTokens: 18,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
          costUsd: 0.0005,
          latencyMs: 600,
        }),
  };

  const auditLogger = { log: jest.fn().mockResolvedValue("audit_xxx") };

  const spendCapEnforcer = {
    canSpend: jest.fn().mockResolvedValue({
      allowed: spendAllowed,
      useCheaperModel: false,
      currentSpendUsd: 0,
      monthlyBudgetUsd: 20,
      percentUsed: 0,
    }),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new OrderConfirmationHandler({
    pool: pool as any,
    messageRepo: messageRepo as any,
    orderRepo: orderRepo as any,
    shopRepo: shopRepo as any,
    customerRepo: customerRepo as any,
    anthropicClient: anthropicClient as any,
    auditLogger: auditLogger as any,
    spendCapEnforcer: spendCapEnforcer as any,
  });

  return {
    handler,
    pool,
    messageRepo,
    orderRepo,
    anthropicClient,
    auditLogger,
    spendCapEnforcer,
  };
};

// ----- Tests -----

describe("OrderConfirmationHandler — fires when conditions met", () => {
  it("sends a confirmation message when conversation exists and has prior AI messages", async () => {
    const { handler, messageRepo, anthropicClient, auditLogger, spendCapEnforcer } =
      makeMocks();

    await handler.handleOrderCompleted(sampleEvent());

    expect(anthropicClient.complete).toHaveBeenCalledTimes(1);
    expect(messageRepo.createMessage).toHaveBeenCalledTimes(1);
    expect(messageRepo.createMessage.mock.calls[0][0].metadata.generated_by).toBe(
      "ai_agent"
    );
    expect(messageRepo.createMessage.mock.calls[0][0].metadata.source).toBe(
      "order_completed"
    );
    expect(messageRepo.createMessage.mock.calls[0][0].senderType).toBe("shop");
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(spendCapEnforcer.recordSpend).toHaveBeenCalledWith("shop_test", 0.0005);
  });

  it("uses Haiku model + tight token budget (cost-conscious)", async () => {
    const { handler, anthropicClient } = makeMocks();
    await handler.handleOrderCompleted(sampleEvent());
    const call = anthropicClient.complete.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5-20251001");
    expect(call.maxTokens).toBeLessThanOrEqual(150);
  });

  it("includes the customer's name + slot label in the prompt", async () => {
    const { handler, anthropicClient } = makeMocks({
      customer: { name: "Lee Ann" },
      order: { bookingDate: new Date("2026-05-08"), bookingTime: "14:30" },
    });
    await handler.handleOrderCompleted(sampleEvent());
    const sysPrompt = anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt).toContain("Lee Ann");
    // Slot formatted in shop tz: 14:30 on 2026-05-08 = Friday at 2:30 PM
    expect(sysPrompt).toContain("Friday at 2:30 PM");
  });
});

describe("OrderConfirmationHandler — skip paths", () => {
  it("skips when no conversation exists for this customer+shop", async () => {
    const { handler, anthropicClient, messageRepo } = makeMocks({
      conversation: null,
    });
    await handler.handleOrderCompleted(sampleEvent());
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when conversation exists but has no prior AI messages", async () => {
    const { handler, anthropicClient, messageRepo } = makeMocks({
      hasPriorAi: false,
    });
    await handler.handleOrderCompleted(sampleEvent());
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when shop ai_global_enabled is false", async () => {
    const { handler, anthropicClient, messageRepo } = makeMocks({
      shopAiGlobalEnabled: false,
    });
    await handler.handleOrderCompleted(sampleEvent());
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when spend cap is exceeded", async () => {
    const { handler, anthropicClient, messageRepo } = makeMocks({
      spendAllowed: false,
    });
    await handler.handleOrderCompleted(sampleEvent());
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when order is not found in DB", async () => {
    const { handler, anthropicClient } = makeMocks({ order: null });
    await handler.handleOrderCompleted(sampleEvent());
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips silently on malformed event payload (does not throw)", async () => {
    const { handler, anthropicClient } = makeMocks();
    // event with missing required fields — handler should log and return
    await expect(
      handler.handleOrderCompleted({
        type: "service.order_completed",
        aggregateId: "x",
        data: { somethingElse: true } as any,
        timestamp: new Date(),
        source: "ServiceDomain",
        version: 1,
      })
    ).resolves.toBeUndefined();
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });
});

describe("OrderConfirmationHandler — failure handling never breaks booking flow", () => {
  it("audit-logs + swallows when Claude fails", async () => {
    const { handler, messageRepo, auditLogger } = makeMocks({
      claudeError: { status: 500, message: "anthropic 500" },
    });
    await expect(handler.handleOrderCompleted(sampleEvent())).resolves.toBeUndefined();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log.mock.calls[0][0].errorMessage).toBe("anthropic 500");
  });

  it("swallows errors thrown by repos so booking flow continues", async () => {
    // Inject a custom orderRepo whose getOrderById rejects
    const orderRepo = {
      getOrderById: jest.fn().mockRejectedValue(new Error("DB outage")),
    };
    // Reuse base mocks to keep it simple, then re-build the handler
    const base = makeMocks();
    const handler = new OrderConfirmationHandler({
      pool: (base.pool as any),
      messageRepo: (base.messageRepo as any),
      orderRepo: (orderRepo as any),
      shopRepo: { getShop: jest.fn().mockResolvedValue({ name: "Peanut" }) } as any,
      customerRepo: { getCustomer: jest.fn().mockResolvedValue({ name: "Lee" }) } as any,
      anthropicClient: (base.anthropicClient as any),
      auditLogger: (base.auditLogger as any),
      spendCapEnforcer: (base.spendCapEnforcer as any),
    });
    await expect(handler.handleOrderCompleted(sampleEvent())).resolves.toBeUndefined();
  });
});

describe("OrderConfirmationHandler — WebSocket broadcast on success", () => {
  it("broadcasts message:new to the customer when WS manager is set", async () => {
    const { handler } = makeMocks();
    const ws = { sendToAddresses: jest.fn() };
    handler.setWebSocketManager(ws as any);
    await handler.handleOrderCompleted(sampleEvent());
    expect(ws.sendToAddresses).toHaveBeenCalledWith(
      ["0xabc"],
      expect.objectContaining({
        type: "message:new",
        payload: { conversationId: "conv_xxx" },
      })
    );
  });

  it("does not crash when WS manager is not set", async () => {
    const { handler } = makeMocks();
    // No setWebSocketManager call
    await expect(handler.handleOrderCompleted(sampleEvent())).resolves.toBeUndefined();
  });
});
