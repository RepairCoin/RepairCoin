// backend/tests/ai-agent/AISalesFollowUpHandler.test.ts
//
// Verifies the AI sales follow-up nudge fires (and skips) under the right
// conditions. The handler is the authoritative gate — every guard tested.

// WS2 tier gate: follow-up is Growth+. Mock the entitlement to allowed so these behavior tests aren't
// blocked by tier resolution (the gate itself is covered in SettingsController/featureTiers tests).
jest.mock("../../src/utils/shopTier", () => ({ shopHasFeature: jest.fn().mockResolvedValue(true) }));

import { AISalesFollowUpHandler } from "../../src/domains/AIAgentDomain/services/AISalesFollowUpHandler";

// ----- Time helpers -----

/**
 * An Etc/GMT timezone string in which the current local hour is `target`.
 * Etc/GMT zones invert the sign (Etc/GMT-5 == UTC+5). Lets the daytime-window
 * tests be deterministic regardless of when CI runs.
 */
function tzWhereHourIs(target: number): string {
  const offset = target - new Date().getUTCHours();
  return offset >= 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

// ----- Mock builder -----

interface MockOpts {
  conversation?: any;
  settings?: any;
  service?: any;
  messages?: any[];
  guard?: any;
  timezone?: string;
  shop?: any;
  customer?: any;
  spendAllowed?: boolean;
  claudeError?: any;
}

const baseConversation = () => ({
  conversation_id: "conv_xxx",
  customer_address: "0xabc",
  shop_id: "shop_test",
  service_id: "srv_x",
  status: "open",
  ai_paused_until: null,
});

const baseSettings = () => ({
  ai_global_enabled: true,
  ai_followup_enabled: true,
  ai_followup_delay_minutes: 20,
});

// A valid "quiet sales episode": customer asked, AI answered with a slot
// card 25 min ago, customer never replied.
const baseMessages = () => [
  {
    senderType: "customer",
    messageText: "anything friday?",
    metadata: {},
    createdAt: minutesAgo(30),
  },
  {
    senderType: "shop",
    messageText: "Yes! Friday 2:30 PM works for AQua Tech.",
    metadata: {
      generated_by: "ai_agent",
      booking_suggestions: [
        { humanLabel: "Friday, May 22 at 2:30 PM", serviceName: "AQua Tech" },
      ],
    },
    createdAt: minutesAgo(25),
  },
];

const makeMocks = (opts: MockOpts = {}) => {
  const conv = "conversation" in opts ? opts.conversation : baseConversation();
  const settings = "settings" in opts ? opts.settings : baseSettings();
  const guard = opts.guard ?? {
    since_last_customer: "0",
    last_24h: "0",
    has_order: false,
  };
  // Default timezone: noon somewhere → inside the 8am-9pm daytime window.
  const timezone = opts.timezone ?? tzWhereHourIs(12);

  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM conversations")) {
        return Promise.resolve({ rows: conv ? [conv] : [] });
      }
      if (sql.includes("ai_shop_settings")) {
        return Promise.resolve({ rows: settings ? [settings] : [] });
      }
      if (sql.includes("shop_time_slot_config")) {
        return Promise.resolve({ rows: [{ timezone }] });
      }
      if (sql.includes("service_orders")) {
        return Promise.resolve({ rows: [guard] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };

  const messageRepo = {
    getRecentConversationMessages: jest
      .fn()
      .mockResolvedValue("messages" in opts ? opts.messages : baseMessages()),
    createMessage: jest.fn().mockResolvedValue({
      message: { messageId: "msg_xxx" },
      created: true,
    }),
  };

  const serviceRepo = {
    getServiceById: jest.fn().mockResolvedValue(
      opts.service ?? {
        serviceId: "srv_x",
        shopId: "shop_test",
        serviceName: "AQua Tech",
        aiSalesEnabled: true,
      }
    ),
  };

  const shopRepo = {
    getShop: jest
      .fn()
      .mockResolvedValue(opts.shop ?? { name: "Peanut", walletAddress: "0xSHOP" }),
  };

  const customerRepo = {
    getCustomer: jest.fn().mockResolvedValue(opts.customer ?? { name: "Qua Ting" }),
  };

  const anthropicClient = {
    complete: opts.claudeError
      ? jest.fn().mockRejectedValue(opts.claudeError)
      : jest.fn().mockResolvedValue({
          text: "Hi Qua Ting — still want me to lock in that Friday 2:30 slot? 😊",
          model: "claude-haiku-4-5-20251001",
          stopReason: "end_turn",
          usage: {
            inputTokens: 220,
            outputTokens: 22,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
          costUsd: 0.0006,
          latencyMs: 700,
        }),
  };

  const auditLogger = { log: jest.fn().mockResolvedValue("audit_xxx") };

  const spendCapEnforcer = {
    canSpend: jest.fn().mockResolvedValue({
      allowed: opts.spendAllowed ?? true,
      useCheaperModel: false,
      currentSpendUsd: 0,
      monthlyBudgetUsd: 20,
      percentUsed: 0,
    }),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new AISalesFollowUpHandler({
    pool: pool as any,
    messageRepo: messageRepo as any,
    shopRepo: shopRepo as any,
    customerRepo: customerRepo as any,
    serviceRepo: serviceRepo as any,
    anthropicClient: anthropicClient as any,
    auditLogger: auditLogger as any,
    spendCapEnforcer: spendCapEnforcer as any,
  });

  return { handler, pool, messageRepo, serviceRepo, anthropicClient, auditLogger, spendCapEnforcer };
};

// ----- Tests -----

describe("AISalesFollowUpHandler — fires when conditions met", () => {
  it("sends a follow-up for a quiet sales episode", async () => {
    const { handler, messageRepo, anthropicClient, spendCapEnforcer } = makeMocks();
    await handler.processFollowUp("conv_xxx");

    expect(anthropicClient.complete).toHaveBeenCalledTimes(1);
    expect(messageRepo.createMessage).toHaveBeenCalledTimes(1);
    const arg = messageRepo.createMessage.mock.calls[0][0];
    expect(arg.metadata.generated_by).toBe("ai_agent");
    expect(arg.metadata.source).toBe("ai_followup");
    expect(arg.senderType).toBe("shop");
    expect(spendCapEnforcer.recordSpend).toHaveBeenCalledWith("shop_test", 0.0006);
  });

  it("references the proposed slot in the prompt", async () => {
    const { handler, anthropicClient } = makeMocks();
    await handler.processFollowUp("conv_xxx");
    const sysPrompt = anthropicClient.complete.mock.calls[0][0].systemPrompt[0].text;
    expect(sysPrompt).toContain("Friday, May 22 at 2:30 PM");
    expect(sysPrompt).toContain("Qua Ting");
  });
});

describe("AISalesFollowUpHandler — skip paths", () => {
  it("skips when ai_followup_enabled is false (staged-rollout gate)", async () => {
    const { handler, messageRepo, anthropicClient } = makeMocks({
      settings: { ...baseSettings(), ai_followup_enabled: false },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when shop AI is globally off", async () => {
    const { handler, anthropicClient } = makeMocks({
      settings: { ...baseSettings(), ai_global_enabled: false },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the conversation is under human takeover (ai_paused_until future)", async () => {
    const { handler, anthropicClient } = makeMocks({
      conversation: {
        ...baseConversation(),
        ai_paused_until: new Date(Date.now() + 60_000),
      },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the last message is a human shop reply (no generated_by)", async () => {
    const { handler, anthropicClient } = makeMocks({
      messages: [
        { senderType: "customer", messageText: "hi", metadata: {}, createdAt: minutesAgo(30) },
        { senderType: "shop", messageText: "human here", metadata: {}, createdAt: minutesAgo(25) },
      ],
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the last message is itself a prior follow-up", async () => {
    const { handler, anthropicClient } = makeMocks({
      messages: [
        { senderType: "customer", messageText: "hi", metadata: {}, createdAt: minutesAgo(60) },
        {
          senderType: "shop",
          messageText: "still there?",
          metadata: { generated_by: "ai_agent", source: "ai_followup" },
          createdAt: minutesAgo(25),
        },
      ],
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the customer has not been quiet long enough", async () => {
    const { handler, anthropicClient } = makeMocks({
      messages: [
        { senderType: "customer", messageText: "hi", metadata: {}, createdAt: minutesAgo(12) },
        {
          senderType: "shop",
          messageText: "Yes!",
          metadata: { generated_by: "ai_agent" },
          createdAt: minutesAgo(10), // only 10 min — under the 20 min delay
        },
      ],
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the conversation has gone cold (quiet > 6h)", async () => {
    const { handler, anthropicClient } = makeMocks({
      messages: [
        { senderType: "customer", messageText: "hi", metadata: {}, createdAt: minutesAgo(60 * 9) },
        {
          senderType: "shop",
          messageText: "Yes!",
          metadata: { generated_by: "ai_agent" },
          createdAt: minutesAgo(60 * 8), // 8h ago
        },
      ],
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when a follow-up was already sent this episode (idempotency)", async () => {
    const { handler, anthropicClient } = makeMocks({
      guard: { since_last_customer: "1", last_24h: "1", has_order: false },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the 24h follow-up cap is reached", async () => {
    const { handler, anthropicClient } = makeMocks({
      guard: { since_last_customer: "0", last_24h: "2", has_order: false },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when an order already exists for the conversation", async () => {
    const { handler, anthropicClient } = makeMocks({
      guard: { since_last_customer: "0", last_24h: "0", has_order: true },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the shop spend cap is exceeded", async () => {
    const { handler, anthropicClient } = makeMocks({ spendAllowed: false });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips outside the shop's daytime window (no overnight nudges)", async () => {
    const { handler, anthropicClient } = makeMocks({ timezone: tzWhereHourIs(3) });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the customer never engaged (no customer message)", async () => {
    const { handler, anthropicClient } = makeMocks({
      messages: [
        {
          senderType: "shop",
          messageText: "Hi! Interested in AQua Tech?",
          metadata: { generated_by: "ai_agent" },
          createdAt: minutesAgo(25),
        },
      ],
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("skips when the conversation is not open", async () => {
    const { handler, anthropicClient } = makeMocks({
      conversation: { ...baseConversation(), status: "resolved" },
    });
    await handler.processFollowUp("conv_xxx");
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });
});

describe("AISalesFollowUpHandler — failure handling", () => {
  it("audit-logs and swallows when the Claude call fails", async () => {
    const { handler, messageRepo, auditLogger } = makeMocks({
      claudeError: { status: 500, message: "anthropic 500" },
    });
    await expect(handler.processFollowUp("conv_xxx")).resolves.toBeUndefined();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log.mock.calls[0][0].errorMessage).toBe("anthropic 500");
  });

  it("swallows a pool failure (never throws to the detector)", async () => {
    const { handler, pool } = makeMocks();
    pool.query.mockRejectedValueOnce(new Error("DB outage"));
    await expect(handler.processFollowUp("conv_xxx")).resolves.toBeUndefined();
  });
});

describe("AISalesFollowUpHandler — WebSocket broadcast", () => {
  it("broadcasts message:new to customer + shop on success", async () => {
    const { handler } = makeMocks();
    const ws = { sendToAddresses: jest.fn() };
    handler.setWebSocketManager(ws as any);
    await handler.processFollowUp("conv_xxx");
    expect(ws.sendToAddresses).toHaveBeenCalledTimes(1);
    const targets = (ws.sendToAddresses as jest.Mock).mock.calls[0][0];
    expect(new Set(targets)).toEqual(new Set(["0xabc", "0xshop"]));
  });

  it("does not crash when no WS manager is set", async () => {
    const { handler } = makeMocks();
    await expect(handler.processFollowUp("conv_xxx")).resolves.toBeUndefined();
  });
});
