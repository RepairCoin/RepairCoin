// backend/tests/ai-agent/AgentOrchestrator.test.ts
//
// Unit tests for the orchestrator dispatch logic. All dependencies mocked —
// no real DB, no real Anthropic call. Verifies:
//   - Each skip reason returns the correct outcome
//   - Escalation triggers correctly and writes audit row
//   - Happy path posts message + audit + spend record
//   - Claude call failure logs error to audit and returns failed result

import { AgentOrchestrator } from "../../src/domains/AIAgentDomain/services/AgentOrchestrator";

function makeMocks(opts: {
  service?: any;
  shopSettings?: any;
  spendAllowed?: boolean;
  useCheaperModel?: boolean;
  shouldEscalate?: boolean;
  claudeResponse?: any;
  claudeError?: any;
  contextHistory?: any[];
} = {}) {
  const service =
    opts.service !== undefined
      ? opts.service
      : {
          serviceId: "srv_test",
          shopId: "shop_test",
          serviceName: "Test Service",
          aiSalesEnabled: true,
          aiTone: "professional",
          aiSuggestUpsells: false,
          priceUsd: 50,
        };

  const shopSettings =
    opts.shopSettings !== undefined
      ? opts.shopSettings
      : { ai_global_enabled: true, escalation_threshold: 5 };

  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM ai_shop_settings")) {
        return Promise.resolve({ rows: shopSettings ? [shopSettings] : [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
  };

  const serviceRepo = {
    getServiceById: jest.fn().mockResolvedValue(service),
  };

  const messageRepo = {
    createMessage: jest.fn().mockResolvedValue({
      message: { messageId: "msg_ai_reply_xxx" },
    }),
  };

  const anthropicClient = {
    complete: opts.claudeError
      ? jest.fn().mockRejectedValue(opts.claudeError)
      : jest.fn().mockResolvedValue(
          opts.claudeResponse || {
            text: "Hello there!",
            model: "claude-sonnet-4-6",
            stopReason: "end_turn",
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationInputTokens: 0,
              cacheReadInputTokens: 0,
            },
            costUsd: 0.001,
            latencyMs: 2500,
          }
        ),
  };

  const contextBuilder = {
    build: jest.fn().mockResolvedValue({
      service: service
        ? {
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            priceUsd: service.priceUsd,
            category: "test",
            description: "test",
            customInstructions: null,
            bookingAssistance: false,
            suggestUpsells: false,
          }
        : null,
      customer: { address: "0xabc", name: "Test", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: { shopId: "shop_test", shopName: "Test Shop", category: "test", hoursSummary: null, timezone: null },
      conversationHistory: opts.contextHistory ?? [],
      siblingServices: [],
    }),
  };

  const auditLogger = {
    log: jest.fn().mockResolvedValue("audit_id_xxx"),
  };

  const spendCapEnforcer = {
    canSpend: jest.fn().mockResolvedValue({
      allowed: opts.spendAllowed ?? true,
      useCheaperModel: opts.useCheaperModel ?? false,
      currentSpendUsd: 5,
      monthlyBudgetUsd: 20,
      percentUsed: 0.25,
    }),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };

  const escalationDetector = {
    shouldEscalate: jest.fn().mockReturnValue({
      shouldEscalate: opts.shouldEscalate ?? false,
      reason: opts.shouldEscalate ? "test_reason" : undefined,
    }),
  };

  const orch = new AgentOrchestrator({
    pool: pool as any,
    serviceRepo: serviceRepo as any,
    messageRepo: messageRepo as any,
    anthropicClient: anthropicClient as any,
    contextBuilder: contextBuilder as any,
    auditLogger: auditLogger as any,
    spendCapEnforcer: spendCapEnforcer as any,
    escalationDetector: escalationDetector as any,
  });

  return {
    orch,
    pool,
    serviceRepo,
    messageRepo,
    anthropicClient,
    contextBuilder,
    auditLogger,
    spendCapEnforcer,
    escalationDetector,
  };
}

const sampleInput = (overrides: any = {}) => ({
  messageId: "msg_customer_xxx",
  conversationId: "conv_xxx",
  customerAddress: "0xabc",
  shopId: "shop_test",
  serviceId: "srv_test",
  customerMessageText: "Hi, what's the price?",
  ...overrides,
});

describe("AgentOrchestrator — happy path", () => {
  it("posts an AI reply, logs audit, and records spend", async () => {
    const { orch, messageRepo, auditLogger, spendCapEnforcer } = makeMocks();
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result.outcome).toBe("ai_replied");
    if (result.outcome === "ai_replied") {
      expect(result.aiMessageId).toBe("msg_ai_reply_xxx");
      expect(result.costUsd).toBe(0.001);
      expect(result.model).toBe("claude-sonnet-4-6");
    }

    expect(messageRepo.createMessage).toHaveBeenCalledTimes(1);
    expect(messageRepo.createMessage.mock.calls[0][0].metadata.generated_by).toBe("ai_agent");

    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    // errorMessage is omitted on success — the field is undefined in the call args.
    // AuditLogger.log normalizes undefined → null at insert time.
    expect(auditLogger.log.mock.calls[0][0].errorMessage).toBeUndefined();

    expect(spendCapEnforcer.recordSpend).toHaveBeenCalledWith("shop_test", 0.001);
  });
});

describe("AgentOrchestrator — skip paths", () => {
  it("skips when service.ai_sales_enabled is false", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({
      service: {
        serviceId: "srv_test",
        shopId: "shop_test",
        serviceName: "Test",
        aiSalesEnabled: false,
        aiTone: "professional",
        priceUsd: 50,
      },
    });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result).toEqual({ outcome: "skipped", reason: "service_ai_disabled" });
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it("skips when shop.ai_global_enabled is false", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({
      shopSettings: { ai_global_enabled: false, escalation_threshold: 5 },
    });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result).toEqual({ outcome: "skipped", reason: "shop_ai_disabled" });
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it("skips when no_shop_settings row exists", async () => {
    const { orch } = makeMocks({ shopSettings: null });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result).toEqual({ outcome: "skipped", reason: "no_shop_settings" });
  });

  it("skips when spend cap is exceeded", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({ spendAllowed: false });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result).toEqual({ outcome: "skipped", reason: "spend_cap_exceeded" });
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it("returns failed when service is not found", async () => {
    const { orch } = makeMocks({ service: null });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error).toMatch(/Service not found/);
    }
  });

  it("skips with service_shop_mismatch when service belongs to a different shop", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({
      service: {
        serviceId: "srv_test",
        shopId: "shop_OTHER", // service belongs to a different shop
        serviceName: "Test",
        aiSalesEnabled: true,
        aiTone: "professional",
        priceUsd: 50,
      },
    });
    // sampleInput.shopId === "shop_test" — mismatch
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result).toEqual({ outcome: "skipped", reason: "service_shop_mismatch" });
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});

describe("AgentOrchestrator — escalation", () => {
  it("escalates and logs audit row with escalated_to_human=true, no AI reply posted", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({ shouldEscalate: true });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result.outcome).toBe("escalated");
    if (result.outcome === "escalated") {
      expect(result.reason).toBe("test_reason");
    }

    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log.mock.calls[0][0].escalatedToHuman).toBe(true);
    expect(auditLogger.log.mock.calls[0][0].costUsd).toBe(0);
  });
});

describe("AgentOrchestrator — Claude call failure", () => {
  it("logs error to audit and returns failed result, no AI reply posted", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({
      claudeError: { status: 500, message: "anthropic 500" },
    });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error).toBe("anthropic 500");
    }

    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log.mock.calls[0][0].errorMessage).toBe("anthropic 500");
    expect(auditLogger.log.mock.calls[0][0].responsePayload).toBeNull();
  });
});

describe("AgentOrchestrator — model selection via spend cap", () => {
  it("uses Sonnet by default", async () => {
    const { orch, anthropicClient } = makeMocks({ useCheaperModel: false });
    await orch.handleCustomerMessage(sampleInput());
    expect(anthropicClient.complete.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("switches to Haiku when spend cap enforcer says useCheaperModel=true", async () => {
    const { orch, anthropicClient } = makeMocks({ useCheaperModel: true });
    await orch.handleCustomerMessage(sampleInput());
    expect(anthropicClient.complete.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("AgentOrchestrator — message handling", () => {
  it("appends current customerMessageText if last history message is not 'user'", async () => {
    const { orch, anthropicClient } = makeMocks({
      contextHistory: [
        { role: "assistant", content: "earlier ai reply", createdAt: new Date() },
      ],
    });
    await orch.handleCustomerMessage(sampleInput({ customerMessageText: "I have a question" }));

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "I have a question" });
  });

  it("does NOT duplicate when last history message is already 'user'", async () => {
    const { orch, anthropicClient } = makeMocks({
      contextHistory: [
        { role: "user", content: "I have a question", createdAt: new Date() },
      ],
    });
    await orch.handleCustomerMessage(sampleInput({ customerMessageText: "I have a question" }));

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    expect(messages).toHaveLength(1);
  });

  it("filters empty-content history turns before sending to Claude", async () => {
    // Anthropic rejects user messages with empty content. Attachment-only,
    // system, encrypted, or otherwise-empty messages must not slip into the
    // request payload. Regression guard for the bug that bricked Task 8's
    // first staging smoke (every history message had content="").
    const { orch, anthropicClient } = makeMocks({
      contextHistory: [
        { role: "user", content: "", createdAt: new Date() }, // attachment-only
        { role: "assistant", content: "shop reply", createdAt: new Date() },
        { role: "user", content: "   ", createdAt: new Date() }, // whitespace-only
        { role: "user", content: "real question", createdAt: new Date() },
      ],
    });
    await orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "real question" })
    );

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    // Empty + whitespace-only turns dropped; the real ones survive.
    expect(messages).toEqual([
      { role: "assistant", content: "shop reply" },
      { role: "user", content: "real question" },
    ]);
  });
});

describe("AgentOrchestrator — booking tool use (Phase 3 fix-6)", () => {
  // Helper to build mocks with availability slots + a tool-use response.
  const slotIso = "2026-05-08T18:00:00.000Z";
  const buildMocksWithSlots = (toolResponse: any) => {
    const mocks = makeMocks({
      claudeResponse: {
        text: "",
        model: "claude-sonnet-4-6",
        stopReason: "tool_use",
        usage: {
          inputTokens: 800,
          outputTokens: 60,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0.003,
        latencyMs: 1500,
        toolUses: toolResponse,
      },
    });
    // Inject availability slots into the context the orchestrator reads
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "Test Service",
        priceUsd: 50,
        category: "test",
        description: "test",
        customInstructions: null,
        bookingAssistance: true,
        suggestUpsells: false,
      },
      customer: { address: "0xabc", name: "Test", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: { shopId: "shop_test", shopName: "Test Shop", category: "test", hoursSummary: null, timezone: null },
      conversationHistory: [],
      siblingServices: [],
      availabilitySlots: [
        {
          date: "2026-05-08",
          time: "14:00",
          slotIso,
          humanLabel: "Friday at 2:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service",
        },
        {
          date: "2026-05-08",
          time: "15:00",
          slotIso: "2026-05-08T19:00:00.000Z",
          humanLabel: "Friday at 3:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service",
        },
      ],
    });
    return mocks;
  };

  it("passes tools to AnthropicClient when availability slots exist", async () => {
    const { orch, anthropicClient } = buildMocksWithSlots([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_xxx",
        input: { slot_iso: slotIso, reply_text: "Friday at 2 PM works." },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = anthropicClient.complete.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe("propose_booking_slot");
    expect(callArgs.tools[0].inputSchema.properties.slot_iso.enum).toContain(slotIso);
    expect(callArgs.toolChoice).toEqual({ type: "auto" });
  });

  it("uses tool output for the customer-facing reply when Claude calls the tool", async () => {
    const { orch, messageRepo } = buildMocksWithSlots([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_xxx",
        input: { slot_iso: slotIso, reply_text: "Friday at 2 PM works — tap below." },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.messageText).toBe("Friday at 2 PM works — tap below.");
    expect(created.metadata.booking_suggestions).toEqual([
      {
        serviceId: "srv_test",
        slotIso,
        humanLabel: "Friday at 2:00 PM",
      },
    ]);
  });

  it("concatenates Claude's text block with tool reply_text for multi-service requests", async () => {
    // Multi-service scenario: customer asks for laptop repair + pastry tutorial.
    // Claude correctly emits BOTH a text block (addressing the laptop repair
    // we can't book) AND a tool_use (booking the pastry tutorial). Prior to
    // this fix, the orchestrator dropped the text block entirely and only
    // sent the tool's reply_text to the customer — UX bug, the customer was
    // never told about the laptop repair handoff. Fix: concatenate both.
    const mocks = makeMocks({
      claudeResponse: {
        text: "For the laptop repair (AQua Tech), you'll need to book that through their service page separately. Want me to flag a teammate to coordinate both?",
        model: "claude-sonnet-4-6",
        stopReason: "tool_use",
        usage: {
          inputTokens: 800,
          outputTokens: 80,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0.003,
        latencyMs: 1500,
        toolUses: [
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_yyy",
            input: {
              slot_iso: slotIso,
              reply_text: "For the pastry tutorial — Friday at 2 PM works! Tap below.",
            },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "Test Service",
        priceUsd: 50,
        category: "test",
        description: "test",
        customInstructions: null,
        bookingAssistance: true,
        suggestUpsells: false,
      },
      customer: { address: "0xabc", name: "Test", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: { shopId: "shop_test", shopName: "Test Shop", category: "test", hoursSummary: null, timezone: null },
      conversationHistory: [],
      siblingServices: [],
      availabilitySlots: [
        {
          date: "2026-05-08",
          time: "14:00",
          slotIso,
          humanLabel: "Friday at 2:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service",
        },
      ],
    });
    await mocks.orch.handleCustomerMessage(sampleInput());

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Both parts must be present in the final message text:
    expect(created.messageText).toContain("laptop repair");
    expect(created.messageText).toContain("For the pastry tutorial");
    expect(created.messageText).toContain("Tap below");
    // Ordering: extra text first, then reply_text (so the tap-to-book card
    // visually follows the slot announcement at the bottom of the bubble).
    const text = created.messageText;
    expect(text.indexOf("laptop repair")).toBeLessThan(text.indexOf("For the pastry tutorial"));
    // Booking suggestion still captured (the pastry slot is the bookable one).
    expect(created.metadata.booking_suggestions).toEqual([
      {
        serviceId: "srv_test",
        slotIso,
        humanLabel: "Friday at 2:00 PM",
      },
    ]);
  });

  it("falls back to reply_text alone when Claude's text block is identical (dedupe)", async () => {
    // Edge case: Claude sometimes emits the same content in both blocks.
    // Concatenating would duplicate. Exact-match guard prevents that.
    const identical = "Friday at 2 PM works — tap below.";
    const mocks = makeMocks({
      claudeResponse: {
        text: identical,
        model: "claude-sonnet-4-6",
        stopReason: "tool_use",
        usage: {
          inputTokens: 800,
          outputTokens: 60,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0.003,
        latencyMs: 1500,
        toolUses: [
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_zzz",
            input: { slot_iso: slotIso, reply_text: identical },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "Test Service",
        priceUsd: 50,
        category: "test",
        description: "test",
        customInstructions: null,
        bookingAssistance: true,
        suggestUpsells: false,
      },
      customer: { address: "0xabc", name: "Test", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: { shopId: "shop_test", shopName: "Test Shop", category: "test", hoursSummary: null, timezone: null },
      conversationHistory: [],
      siblingServices: [],
      availabilitySlots: [
        {
          date: "2026-05-08",
          time: "14:00",
          slotIso,
          humanLabel: "Friday at 2:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service",
        },
      ],
    });
    await mocks.orch.handleCustomerMessage(sampleInput());

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Should NOT appear twice — exact-match guard kicks in.
    expect(created.messageText).toBe(identical);
    expect(created.messageText.indexOf(identical)).toBe(0);
    expect(created.messageText.lastIndexOf(identical)).toBe(0);
  });

  it("falls back to text parser when Claude does NOT call the tool", async () => {
    // Customer asked a non-booking question; Claude returns plain text
    const { orch, messageRepo } = buildMocksWithSlots([]);
    // Override the response text since plain-text path uses claudeResponse.text
    const { orch: o2, messageRepo: m2 } = makeMocks({
      claudeResponse: {
        text: "It includes a full diagnostic plus a courtesy wash.",
        model: "claude-sonnet-4-6",
        stopReason: "end_turn",
        usage: {
          inputTokens: 800,
          outputTokens: 60,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0.003,
        latencyMs: 1500,
        toolUses: [],
      },
    });
    await o2.handleCustomerMessage(sampleInput());
    const created = m2.createMessage.mock.calls[0][0];
    expect(created.messageText).toBe("It includes a full diagnostic plus a courtesy wash.");
    expect(created.metadata.booking_suggestions).toBeUndefined();
  });

  it("rejects + flags tool calls with out-of-enum slot_iso", async () => {
    // Anthropic SHOULD reject this at the API boundary, but defense-in-depth:
    // if a hallucinated slot slips through, we drop it.
    const { orch, messageRepo } = buildMocksWithSlots([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_xxx",
        input: {
          slot_iso: "2026-12-31T20:00:00.000Z", // not in availability set
          reply_text: "How about New Year's Eve?",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());
    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "tool_returned_invalid_slot",
    ]);
  });

  it("does NOT pass tools when availability slots are empty", async () => {
    const { orch, anthropicClient } = makeMocks({
      claudeResponse: {
        text: "Sorry, no openings this week.",
        model: "claude-sonnet-4-6",
        stopReason: "end_turn",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0.001,
        latencyMs: 1500,
        toolUses: [],
      },
    });
    await orch.handleCustomerMessage(sampleInput());
    const callArgs = anthropicClient.complete.mock.calls[0][0];
    expect(callArgs.tools).toBeUndefined();
  });
});
