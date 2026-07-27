// backend/tests/ai-agent/AgentOrchestrator.test.ts
//
// Unit tests for the orchestrator dispatch logic. All dependencies mocked —
// no real DB, no real Anthropic call. Verifies:
//   - Each skip reason returns the correct outcome
//   - Escalation triggers correctly and writes audit row
//   - Happy path posts message + audit + spend record
//   - Claude call failure logs error to audit and returns failed result

// WS2 auto-reply gate — mock the tier entitlement so we can drive the flag path
// without a DB. Defaults to true so the existing tests are unaffected.
jest.mock("../../src/utils/shopTier", () => ({
  shopHasFeature: jest.fn().mockResolvedValue(true),
}));

import {
  AgentOrchestrator,
  detectMentionedServices,
  collectPriorBookingPairs,
  detectCrossServiceOfferFollowUp,
  isLikelyDuplicateText,
  resolveDiscussedServiceId,
} from "../../src/domains/AIAgentDomain/services/AgentOrchestrator";
import { shopHasFeature } from "../../src/utils/shopTier";

const mockShopHasFeature = shopHasFeature as jest.MockedFunction<typeof shopHasFeature>;

function makeMocks(opts: {
  service?: any;
  shopSettings?: any;
  spendAllowed?: boolean;
  useCheaperModel?: boolean;
  shouldEscalate?: boolean;
  claudeResponse?: any;
  claudeError?: any;
  contextHistory?: any[];
  // Phase 2 human-handoff: drives the orchestrator's ai_paused check.
  // null/undefined = AI active. Future Date = paused. Past Date = ignored.
  aiPausedUntil?: Date | null;
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
      // Orchestrator's Phase 2 ai_paused lookup. Returns the configured
      // ai_paused_until (or null/undefined for "AI active").
      if (sql.includes("SELECT ai_paused_until FROM conversations")) {
        return Promise.resolve({
          rows: [{ ai_paused_until: opts.aiPausedUntil ?? null }],
        });
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

describe("AgentOrchestrator — escalation (post-2026-05-15: Claude handles handoff via rule #4)", () => {
  // Pre-fix: matching escalation keywords short-circuited the turn entirely
  // — no Claude call, no AI message. Customer saw the typing indicator
  // appear and time out without acknowledgement. Now: the detector still
  // fires for telemetry (audit-log flag), but the orchestrator proceeds
  // to Claude so rule #4 produces a polite "teammate will follow up"
  // reply. Customer always gets an acknowledgement.

  it("still calls Claude on escalation keywords (no early short-circuit)", async () => {
    const { orch, anthropicClient } = makeMocks({ shouldEscalate: true });
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
    expect(anthropicClient.complete).toHaveBeenCalled();
  });

  it("posts the AI message + audit row with escalatedToHuman=true", async () => {
    const { orch, messageRepo, auditLogger } = makeMocks({ shouldEscalate: true });
    await orch.handleCustomerMessage(sampleInput());

    // Message was actually posted (rule #4 generated the handoff line).
    expect(messageRepo.createMessage).toHaveBeenCalled();
    // Single audit row from the successful Claude call, with the
    // escalation flag stamped on it for admin telemetry.
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    const audit = auditLogger.log.mock.calls[0][0];
    expect(audit.escalatedToHuman).toBe(true);
    expect(audit.costUsd).toBeGreaterThan(0); // real Claude call, real cost
    // errorMessage is undefined on success-path audits (not explicitly
    // set vs the failure-path which sets it to the thrown error string)
    expect(audit.errorMessage).toBeFalsy();
  });

  it("flags escalatedToHuman=false on non-escalation turns", async () => {
    const { orch, auditLogger } = makeMocks({ shouldEscalate: false });
    await orch.handleCustomerMessage(sampleInput());
    expect(auditLogger.log.mock.calls[0][0].escalatedToHuman).toBe(false);
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
        {
          role: "assistant",
          content: "earlier ai reply",
          createdAt: new Date(),
          // generated_by stamp keeps this mock from triggering the
          // human-takeover prefilter (added 2026-05-15).
          metadata: { generated_by: "ai_agent" },
        },
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
    // After the active-topic reminder injection: when the customer's
    // message names no service, an internal assistant note is spliced
    // in BEFORE the user turn. The user turn itself is not duplicated.
    const userTurns = messages.filter((m: any) => m.role === "user");
    expect(userTurns).toHaveLength(1);
    expect(userTurns[0].content).toBe("I have a question");
  });

  it("filters empty-content history turns before sending to Claude", async () => {
    // Anthropic rejects user messages with empty content. Attachment-only,
    // system, encrypted, or otherwise-empty messages must not slip into the
    // request payload. Regression guard for the bug that bricked Task 8's
    // first staging smoke (every history message had content="").
    const { orch, anthropicClient } = makeMocks({
      contextHistory: [
        { role: "user", content: "", createdAt: new Date() }, // attachment-only
        {
          role: "assistant",
          content: "shop reply",
          createdAt: new Date(),
          metadata: { generated_by: "ai_agent" },
        },
        { role: "user", content: "   ", createdAt: new Date() }, // whitespace-only
        { role: "user", content: "real question", createdAt: new Date() },
      ],
    });
    await orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "real question" })
    );

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    // Empty + whitespace-only history turns dropped; the real ones survive.
    // The active-topic reminder may also be present (synthetic assistant
    // turn before the user message). Filter to the customer's own content
    // for the assertion that doesn't depend on the reminder.
    const userTurns = messages.filter((m: any) => m.role === "user");
    expect(userTurns).toEqual([{ role: "user", content: "real question" }]);
    // The "shop reply" history turn survives as an assistant turn.
    const assistantContent = messages
      .filter((m: any) => m.role === "assistant")
      .map((m: any) => m.content);
    expect(assistantContent).toContain("shop reply");
  });

  it("injects an active-topic reminder when customer names no service", async () => {
    // Active-topic reminder injection (paired with Rule #13). When the
    // customer's message contains no service-name reference, splice a
    // synthetic assistant turn IN FRONT of their user message containing
    // the focused service name. Anthropic's recency bias then favors
    // the anchor over historical service mentions.
    const { orch, anthropicClient } = makeMocks();
    await orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "what is the price?" })
    );

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    // Expect: [assistant reminder, user question]
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const lastTwo = messages.slice(-2);
    expect(lastTwo[0].role).toBe("assistant");
    expect(lastTwo[0].content).toMatch(/anchored to "Test Service"/);
    expect(lastTwo[0].content).toMatch(/answer using the "About this service" block/i);
    expect(lastTwo[1]).toEqual({ role: "user", content: "what is the price?" });
  });

  it("does NOT inject the active-topic reminder when customer names a service", async () => {
    // If the customer explicitly names a service (e.g., "what about
    // AQua Tech?"), the reminder would force the anchor and suppress
    // the customer's stated intent. Skip injection in that case.
    const { orch, anthropicClient } = makeMocks();
    await orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "what about Test Service?" })
    );

    const messages = anthropicClient.complete.mock.calls[0][0].messages;
    // Last message should be the user question, no reminder before it.
    const last = messages[messages.length - 1];
    expect(last).toEqual({ role: "user", content: "what about Test Service?" });
    // The previous message (if any) should not be the reminder note.
    if (messages.length >= 2) {
      expect(messages[messages.length - 2].content).not.toMatch(/anchored to/i);
    }
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
        serviceName: "Test Service",
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
        serviceName: "Test Service",
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

  it("does NOT pass the booking tool when availability slots are empty (but still offers schedule_followup)", async () => {
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
    // schedule_followup is always offered so the AI can arm an inactivity
    // follow-up per shop memory even when there are no bookable slots — but the
    // booking tool must NOT be passed when availability is empty.
    const toolNames = (callArgs.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolNames).toEqual(["schedule_followup"]);
  });
});

describe("AgentOrchestrator — Phase 3 multi tool_use blocks", () => {
  // Phase 3 lifted the "one tap card per call" restriction. Claude can now
  // emit N tool_use blocks in a single response; the orchestrator iterates,
  // validates each, dedupes (serviceId, slotIso) pairs, and renders one
  // booking_suggestion per valid block.

  const slotA = "2026-05-08T18:00:00.000Z";
  const slotB = "2026-05-09T14:00:00.000Z";

  const buildMultiServiceMocks = (toolUses: any[]) => {
    const mocks = makeMocks({
      claudeResponse: {
        text: "",
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
        toolUses,
      },
    });
    // Two AI-enabled services, each with its own slot.
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "Test Service A",
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
      upcomingAppointments: [],

      shopServiceMenu: [],
      availabilitySlots: [
        {
          date: "2026-05-08",
          time: "14:00",
          slotIso: slotA,
          humanLabel: "Friday at 2:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service A",
        },
        {
          date: "2026-05-09",
          time: "10:00",
          slotIso: slotB,
          humanLabel: "Saturday at 10:00 AM",
          serviceId: "srv_other",
          serviceName: "Test Service B",
        },
      ],
    });
    return mocks;
  };

  it("renders one booking suggestion per valid tool_use block when Claude emits two", async () => {
    const { orch, messageRepo } = buildMultiServiceMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_1",
        input: {
          service_id: "srv_test",
          slot_iso: slotA,
          reply_text: "For Service A — Friday at 2 PM works.",
        },
      },
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_2",
        input: {
          service_id: "srv_other",
          slot_iso: slotB,
          reply_text: "And for Service B — Saturday at 10 AM works.",
        },
      },
    ]);
    // Multi-service test: customer message must name both services so the
    // focused-default filter (which restricts the tool to focused-only when
    // no service is named) doesn't strip the srv_other slot.
    await orch.handleCustomerMessage(
      sampleInput({
        customerMessageText: "book me both Test Service A AND Test Service B this week",
      })
    );

    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      { serviceId: "srv_test", serviceName: "Test Service A", slotIso: slotA, humanLabel: "Friday at 2:00 PM" },
      { serviceId: "srv_other", serviceName: "Test Service B", slotIso: slotB, humanLabel: "Saturday at 10:00 AM" },
    ]);
    // Both reply_texts present in order, separated by a blank line
    expect(created.messageText).toContain("For Service A — Friday at 2 PM works.");
    expect(created.messageText).toContain("And for Service B — Saturday at 10 AM works.");
    expect(
      created.messageText.indexOf("For Service A")
    ).toBeLessThan(
      created.messageText.indexOf("And for Service B")
    );
  });

  it("preserves valid tool_use blocks even when other blocks in the same response are invalid", async () => {
    const { orch, messageRepo } = buildMultiServiceMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_good",
        input: {
          service_id: "srv_test",
          slot_iso: slotA,
          reply_text: "For Service A — Friday at 2 PM works.",
        },
      },
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_bad",
        input: {
          service_id: "srv_test",
          slot_iso: "2026-12-31T00:00:00.000Z", // hallucinated slot
          reply_text: "And on New Year's Eve?",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      { serviceId: "srv_test", serviceName: "Test Service A", slotIso: slotA, humanLabel: "Friday at 2:00 PM" },
    ]);
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "tool_returned_invalid_slot",
    ]);
    // The valid reply_text reaches the customer
    expect(created.messageText).toContain("For Service A — Friday at 2 PM works.");
    // The invalid block's reply_text is dropped (not shown to customer)
    expect(created.messageText).not.toContain("New Year's Eve");
  });

  it("dedupes duplicate (service_id, slot_iso) pairs across tool calls", async () => {
    const { orch, messageRepo } = buildMultiServiceMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_dup_1",
        input: {
          service_id: "srv_test",
          slot_iso: slotA,
          reply_text: "First mention of Friday 2 PM.",
        },
      },
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_dup_2",
        input: {
          service_id: "srv_test",
          slot_iso: slotA, // same pair as above
          reply_text: "Same slot mentioned twice.",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const created = messageRepo.createMessage.mock.calls[0][0];
    // Only the first occurrence wins.
    expect(created.metadata.booking_suggestions).toEqual([
      { serviceId: "srv_test", serviceName: "Test Service A", slotIso: slotA, humanLabel: "Friday at 2:00 PM" },
    ]);
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "tool_returned_duplicate_pair",
    ]);
  });

  it("rejects all blocks when every one is invalid, surfacing all drop reasons", async () => {
    const { orch, messageRepo } = buildMultiServiceMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_bad_1",
        input: {
          service_id: "srv_test",
          slot_iso: "2026-12-31T00:00:00.000Z", // hallucinated
          reply_text: "Bad slot one",
        },
      },
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_bad_2",
        input: {
          service_id: "srv_test", // valid service
          slot_iso: slotB,         // belongs to srv_other — mismatch
          reply_text: "Cross-group mismatch",
        },
      },
    ]);
    // Customer names both services so the cross-group mismatch path
    // remains exercisable (else the focused-default filter strips slotB
    // and the mismatch becomes a plain invalid_slot instead).
    await orch.handleCustomerMessage(
      sampleInput({
        customerMessageText: "book me Test Service A AND Test Service B this week",
      })
    );

    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "tool_returned_invalid_slot",
      "tool_returned_service_slot_mismatch",
    ]);
  });

  it("flags empty reply_text but accepts the rest of a multi-tool response", async () => {
    const { orch, messageRepo } = buildMultiServiceMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_empty_reply",
        input: {
          service_id: "srv_test",
          slot_iso: slotA,
          reply_text: "   ", // whitespace only → rejected
        },
      },
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_ok",
        input: {
          service_id: "srv_other",
          slot_iso: slotB,
          reply_text: "For Service B — Saturday at 10 AM works.",
        },
      },
    ]);
    // Need srv_other slots to survive the focused-default filter so the
    // partner-survives-empty-reply scenario stays exercised.
    await orch.handleCustomerMessage(
      sampleInput({
        customerMessageText: "book me Test Service A AND Test Service B this week",
      })
    );

    const created = messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      { serviceId: "srv_other", serviceName: "Test Service B", slotIso: slotB, humanLabel: "Saturday at 10:00 AM" },
    ]);
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "tool_returned_empty_reply_text",
    ]);
  });

  it("prepends Claude's text block before the concatenated reply_texts when both are present", async () => {
    const mocks = makeMocks({
      claudeResponse: {
        text: "Lining both up now:",
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
            toolUseId: "tool_1",
            input: {
              service_id: "srv_test",
              slot_iso: slotA,
              reply_text: "For Service A — Friday at 2 PM.",
            },
          },
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_2",
            input: {
              service_id: "srv_other",
              slot_iso: slotB,
              reply_text: "And for Service B — Saturday at 10 AM.",
            },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "Test Service A",
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
      upcomingAppointments: [],

      shopServiceMenu: [],
      availabilitySlots: [
        {
          date: "2026-05-08",
          time: "14:00",
          slotIso: slotA,
          humanLabel: "Friday at 2:00 PM",
          serviceId: "srv_test",
          serviceName: "Test Service A",
        },
        {
          date: "2026-05-09",
          time: "10:00",
          slotIso: slotB,
          humanLabel: "Saturday at 10:00 AM",
          serviceId: "srv_other",
          serviceName: "Test Service B",
        },
      ],
    });
    await mocks.orch.handleCustomerMessage(
      sampleInput({
        customerMessageText: "book me Test Service A AND Test Service B this week",
      })
    );
    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.messageText.startsWith("Lining both up now:")).toBe(true);
    expect(created.messageText).toContain("For Service A — Friday at 2 PM.");
    expect(created.messageText).toContain("And for Service B — Saturday at 10 AM.");
  });
});

describe("detectMentionedServices — service-name presence in customer message", () => {
  const services = [
    { serviceId: "srv_aqua", serviceName: "AQua Tech" },
    { serviceId: "srv_newly", serviceName: "Newly Baker" },
    { serviceId: "srv_mongo", serviceName: "Mongo Tea" },
  ];

  it("returns empty set when message names no service", () => {
    expect(detectMentionedServices("book me thursday at 2pm", services).size).toBe(0);
    expect(detectMentionedServices("I want an appointment", services).size).toBe(0);
    expect(detectMentionedServices("any morning slot?", services).size).toBe(0);
    expect(detectMentionedServices("yes please book it", services).size).toBe(0);
  });

  it("detects an exact-case service name", () => {
    const result = detectMentionedServices("book me AQua Tech thursday at 2pm", services);
    expect(result.has("srv_aqua")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("detects names case-insensitively", () => {
    expect(detectMentionedServices("book aqua tech thursday", services).has("srv_aqua")).toBe(true);
    expect(detectMentionedServices("book AQUA TECH thursday", services).has("srv_aqua")).toBe(true);
    expect(detectMentionedServices("book newly baker thursday", services).has("srv_newly")).toBe(true);
  });

  it("respects word boundaries (avoids substring false positives)", () => {
    // "test" inside "testing" must NOT match a service literally named "Test"
    const svcWithTest = [
      ...services,
      { serviceId: "srv_test", serviceName: "Test" },
    ];
    expect(detectMentionedServices("just testing the system", svcWithTest).has("srv_test")).toBe(false);
    // But "test" on its own word should match
    expect(detectMentionedServices("book me Test thursday", svcWithTest).has("srv_test")).toBe(true);
  });

  it("detects multiple services when both named in one message", () => {
    const result = detectMentionedServices(
      "book me both — AQua Tech AND Newly Baker, anything this week",
      services
    );
    expect(result.has("srv_aqua")).toBe(true);
    expect(result.has("srv_newly")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("skips service names shorter than 3 chars (too noisy)", () => {
    const shortNames = [
      { serviceId: "srv_2c", serviceName: "AT" },
      { serviceId: "srv_normal", serviceName: "Newly Baker" },
    ];
    // "at" appears constantly in English — would false-match. Should be skipped.
    expect(detectMentionedServices("book me at 2pm", shortNames).has("srv_2c")).toBe(false);
    // Longer names still work
    expect(
      detectMentionedServices("book me Newly Baker thursday", shortNames).has("srv_normal")
    ).toBe(true);
  });

  it("handles empty / non-string inputs without crashing", () => {
    expect(detectMentionedServices("", services).size).toBe(0);
    expect(detectMentionedServices(null as any, services).size).toBe(0);
    expect(detectMentionedServices(undefined as any, services).size).toBe(0);
    expect(detectMentionedServices("anything", []).size).toBe(0);
  });

  it("escapes regex metacharacters in service names", () => {
    // Service names containing regex special chars must be escaped to
    // search literally (no accidental regex interpretation).
    const weirdNames = [
      { serviceId: "srv_special", serviceName: "C++ Tutoring (Beginner)" },
    ];
    expect(
      detectMentionedServices("book me C++ Tutoring (Beginner) thursday", weirdNames).has(
        "srv_special"
      )
    ).toBe(true);
    // The unescaped variant of these chars would be a regex error; check
    // that the function doesn't throw on innocent prose either.
    expect(() => detectMentionedServices("just hello", weirdNames)).not.toThrow();
  });
});

describe("AgentOrchestrator — focused-default server enforcement", () => {
  // Integration tests: when the customer's CURRENT message names no
  // service, the orchestrator filters ctx.availabilitySlots down to the
  // focused service only — so the tool's service_id enum (and thus
  // Claude's choices) cannot include non-focused services. Closes the
  // history-bias drift loophole that prompt rules alone couldn't.

  // serviceId must match sampleInput().serviceId (which is "srv_test") so
  // the orchestrator's focused-service filter resolves to the right
  // entries in ctx.availabilitySlots.
  const focusedServiceId = "srv_test";
  const otherServiceId = "srv_other";
  const focusedSlotIso = "2026-05-14T18:00:00.000Z";
  const otherSlotIso = "2026-05-14T13:00:00.000Z";

  const buildCtx = () => ({
    service: {
      serviceId: focusedServiceId,
      serviceName: "Focus Service",
      priceUsd: 50,
      category: "test",
      description: "test",
      customInstructions: null,
      bookingAssistance: true,
      suggestUpsells: false,
    },
    customer: {
      address: "0xabc",
      name: "Test",
      tier: "BRONZE",
      rcnBalance: 0,
      joinedAt: null,
    },
    shop: {
      shopId: "shop_test",
      shopName: "Test Shop",
      category: "test",
      hoursSummary: null,
      timezone: null,
    },
    conversationHistory: [],
    siblingServices: [],
    upcomingAppointments: [],

    shopServiceMenu: [
      {
        serviceId: otherServiceId,
        serviceName: "Other Service",
        priceUsd: 99,
        category: "other",
        shortBlurb: null,
        bookingAssistance: true,
      },
    ],
    availabilitySlots: [
      {
        date: "2026-05-14",
        time: "14:00",
        slotIso: focusedSlotIso,
        humanLabel: "Thursday at 2:00 PM",
        serviceId: focusedServiceId,
        serviceName: "Focus Service",
      },
      {
        date: "2026-05-14",
        time: "09:00",
        slotIso: otherSlotIso,
        humanLabel: "Thursday at 9:00 AM",
        serviceId: otherServiceId,
        serviceName: "Other Service",
      },
    ],
  });

  it("restricts tool's slot_iso enum to focused service when customer names NO service", async () => {
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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(buildCtx());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "book me thursday at 2pm" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    const svcEnum = callArgs.tools[0].inputSchema.properties.service_id.enum;
    // Only the focused service's slot remains
    expect(slotEnum).toEqual([focusedSlotIso]);
    // service_id enum is also collapsed to focused only
    expect(svcEnum).toEqual([focusedServiceId]);
  });

  it("keeps the full multi-service slot list when customer NAMES the focused service", async () => {
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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(buildCtx());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "book me Focus Service thursday at 2pm" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    // Both services' slots present (customer's mention preserved the multi-service path)
    expect(slotEnum).toContain(focusedSlotIso);
    expect(slotEnum).toContain(otherSlotIso);
  });

  it("keeps the full multi-service slot list when customer NAMES a non-focused service", async () => {
    // Customer asks specifically for "Other Service" — anchored to Focus
    // Service. The filter should NOT kick in (the customer named a
    // service); the full slot list passes through and Claude can book the
    // named service.
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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(buildCtx());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "book me Other Service thursday at 9am" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    expect(slotEnum).toContain(focusedSlotIso);
    expect(slotEnum).toContain(otherSlotIso);
  });

  it("end-to-end: Claude books focused service even with non-focused slots originally available", async () => {
    // Closes the loop on the staging bug: customer in a Newly-Baker-heavy
    // conversation switches to AQua Tech, asks "book me thursday at 2pm".
    // Pre-fix: Claude picked Newly Baker. Post-fix: the tool's enum only
    // has the focused (AQua Tech) slot, so Claude has nothing else to
    // pick. The booking_suggestion lands on the focused service.
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
        toolUses: [
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_1",
            input: {
              service_id: focusedServiceId,
              slot_iso: focusedSlotIso,
              reply_text: "Thursday at 2:00 PM works!",
            },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(buildCtx());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "book me thursday at 2pm" })
    );

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      expect.objectContaining({ serviceId: focusedServiceId, slotIso: focusedSlotIso }),
    ]);
  });
});

describe("collectPriorBookingPairs — extract prior assistant's proposed slots", () => {
  it("returns empty set when history is empty or null", () => {
    expect(collectPriorBookingPairs([]).size).toBe(0);
    expect(collectPriorBookingPairs(null as any).size).toBe(0);
    expect(collectPriorBookingPairs(undefined as any).size).toBe(0);
  });

  it("returns pairs from the most recent assistant message's metadata", () => {
    const history = [
      { role: "user", metadata: undefined },
      {
        role: "assistant",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_a", slotIso: "2026-05-12T19:00:00.000Z" },
          ],
        },
      },
      { role: "user", metadata: undefined },
    ];
    const pairs = collectPriorBookingPairs(history);
    expect(pairs.has("srv_a|2026-05-12T19:00:00.000Z")).toBe(true);
    expect(pairs.size).toBe(1);
  });

  it("stops at the latest assistant turn even when older assistants had bookings", () => {
    // Only the IMMEDIATE predecessor matters for loop detection.
    const history = [
      {
        role: "assistant",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_old", slotIso: "2026-01-01T10:00:00.000Z" },
          ],
        },
      },
      { role: "user", metadata: undefined },
      {
        role: "assistant",
        metadata: { booking_suggestions: [] }, // most recent: no slots proposed
      },
      { role: "user", metadata: undefined },
    ];
    const pairs = collectPriorBookingPairs(history);
    // Should NOT pick up srv_old — only the latest assistant is considered.
    expect(pairs.size).toBe(0);
  });

  it("returns empty set when latest assistant has no metadata", () => {
    const history = [{ role: "assistant", metadata: undefined }];
    expect(collectPriorBookingPairs(history).size).toBe(0);
  });

  it("returns empty set when latest assistant has metadata but no booking_suggestions", () => {
    const history = [
      { role: "assistant", metadata: { generated_by: "ai_agent" } },
    ];
    expect(collectPriorBookingPairs(history).size).toBe(0);
  });

  it("collects multiple pairs from a single assistant turn (multi-service reply)", () => {
    const history = [
      {
        role: "assistant",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_a", slotIso: "2026-05-12T19:00:00.000Z" },
            { serviceId: "srv_b", slotIso: "2026-05-13T14:00:00.000Z" },
          ],
        },
      },
    ];
    const pairs = collectPriorBookingPairs(history);
    expect(pairs.size).toBe(2);
    expect(pairs.has("srv_a|2026-05-12T19:00:00.000Z")).toBe(true);
    expect(pairs.has("srv_b|2026-05-13T14:00:00.000Z")).toBe(true);
  });

  it("skips suggestions missing serviceId or slotIso defensively", () => {
    const history = [
      {
        role: "assistant",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_a", slotIso: "2026-05-12T19:00:00.000Z" },
            { serviceId: "srv_b" }, // missing slotIso
            { slotIso: "2026-05-13T14:00:00.000Z" }, // missing serviceId
            null,
          ],
        },
      },
    ];
    const pairs = collectPriorBookingPairs(history);
    expect(pairs.size).toBe(1);
    expect(pairs.has("srv_a|2026-05-12T19:00:00.000Z")).toBe(true);
  });
});

describe("AgentOrchestrator — same-slot loop guard", () => {
  // Mike's bug. Repro: an AI turn proposed Tuesday 3 PM. The customer's
  // next turn was a non-booking signal ("so u sell bread", "what u sell",
  // "thank u"). Claude re-fired the booking tool with the same Tuesday 3
  // PM slot. The loop guard drops the duplicate so the customer sees a
  // text reply instead of a third copy of the same tap card.

  const slotIso = "2026-05-12T19:00:00.000Z";
  const focusedServiceId = "srv_test";

  const ctxWithPriorBooking = () => ({
    service: {
      serviceId: focusedServiceId,
      serviceName: "Test Service",
      priceUsd: 50,
      category: "test",
      description: "test",
      bookingAssistance: true,
      suggestUpsells: false,
      faqEntries: [],
    },
    customer: {
      address: "0xabc",
      name: "Mike",
      tier: "BRONZE",
      rcnBalance: 0,
      joinedAt: null,
    },
    shop: {
      shopId: "shop_test",
      shopName: "Test Shop",
      category: "test",
      hoursSummary: null,
      timezone: null,
    },
    // The prior AI turn proposed Tuesday 3 PM and the customer is now
    // sending a non-acceptance reply. Loop guard should drop the
    // duplicate if Claude tries to re-propose.
    conversationHistory: [
      { role: "user", content: "what times do you have?", createdAt: new Date() },
      {
        role: "assistant",
        content: "Earliest is Tuesday at 3 PM — tap below.",
        createdAt: new Date(),
        metadata: {
          generated_by: "ai_agent",
          booking_suggestions: [
            { serviceId: focusedServiceId, slotIso, humanLabel: "Tuesday at 3:00 PM" },
          ],
        },
      },
    ],
    siblingServices: [],
    upcomingAppointments: [],

    shopServiceMenu: [],
    availabilitySlots: [
      {
        date: "2026-05-12",
        time: "15:00",
        slotIso,
        humanLabel: "Tuesday at 3:00 PM",
        serviceId: focusedServiceId,
        serviceName: "Test Service",
      },
    ],
  });

  const buildLoopMocks = (
    customerMessageText: string,
    claudeText: string = ""
  ) => {
    const mocks = makeMocks({
      claudeResponse: {
        text: claudeText,
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
            toolUseId: "tool_loop",
            input: {
              service_id: focusedServiceId,
              slot_iso: slotIso,
              reply_text: "Earliest available is today at 3:00 PM — tap below.",
            },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctxWithPriorBooking());
    return { mocks, customerMessageText };
  };

  it("drops the tool block when the customer's reply is gratitude (\"thank u\")", async () => {
    const { mocks, customerMessageText } = buildLoopMocks("thank u");
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "loop_guard_same_slot",
    ]);
    // No tool block → no card. The customer sees a text reply. The prior
    // tap card from the previous AI turn is still in their chat scroll.
  });

  it("drops the tool block when the customer's reply is off-topic (\"so u sell bread\")", async () => {
    const { mocks, customerMessageText } = buildLoopMocks("so u sell bread");
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "loop_guard_same_slot",
    ]);
  });

  it("drops the tool block when the customer asks a shop-scope question (\"what u sell\")", async () => {
    const { mocks, customerMessageText } = buildLoopMocks("what u sell");
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "loop_guard_same_slot",
    ]);
  });

  it("falls back to LOOP_GUARD_FALLBACK_TEXT when Claude emitted no companion text", async () => {
    // If Claude's response was tool-only (empty text block) and the guard
    // drops the only tool, the customerFacingText would otherwise be ""
    // — Anthropic returns just the tool call. The fallback ensures the
    // customer gets a brief acknowledgement rather than an empty bubble.
    const { mocks, customerMessageText } = buildLoopMocks("thank u", "");
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(typeof created.messageText).toBe("string");
    expect(created.messageText.length).toBeGreaterThan(0);
  });

  it("uses Claude's companion text when present and guard drops the tool", async () => {
    const { mocks, customerMessageText } = buildLoopMocks(
      "what u sell",
      "We focus on Test Service — building your own personal helper bot."
    );
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Claude's text answers the customer's actual question — keep it.
    expect(created.messageText).toContain("Test Service");
    expect(created.metadata.booking_suggestions).toBeUndefined();
  });

  it("ALSO drops the tool block on acceptance (\"yes please\") — prior card handles booking", async () => {
    // Option B: the guard is unconditional. On real acceptance, Claude's
    // prompt tells it to reply in text ("Great — tap the card above!")
    // instead of re-firing the tool. If Claude misbehaves and fires
    // anyway, the guard catches it. The prior tap card is still visible
    // in the chat and still the booking action.
    const { mocks, customerMessageText } = buildLoopMocks(
      "yes please",
      "Great — tap the card above to lock in Tuesday at 3 PM!"
    );
    await mocks.orch.handleCustomerMessage(sampleInput({ customerMessageText }));

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Duplicate dropped — same as the non-acceptance case.
    expect(created.metadata.booking_suggestions).toBeUndefined();
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "loop_guard_same_slot",
    ]);
    // Claude's companion text reaches the customer (they get a brief
    // confirmation pointing at the existing card).
    expect(created.messageText).toContain("tap the card");
  });

  it("KEEPS the tool block when Claude proposes a DIFFERENT slot", async () => {
    // Customer's non-acceptance reply, but Claude proposes Wednesday
    // instead of Tuesday — not a duplicate, so the guard leaves it alone.
    const newerSlotIso = "2026-05-13T19:00:00.000Z";
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
        toolUses: [
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_diff",
            input: {
              service_id: focusedServiceId,
              slot_iso: newerSlotIso,
              reply_text: "How about Wednesday at 3 PM?",
            },
          },
        ],
      },
    });
    const ctx = ctxWithPriorBooking();
    // Add Wednesday slot to availability so the validator accepts it.
    ctx.availabilitySlots.push({
      date: "2026-05-13",
      time: "15:00",
      slotIso: newerSlotIso,
      humanLabel: "Wednesday at 3:00 PM",
      serviceId: focusedServiceId,
      serviceName: "Test Service",
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctx);

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "thank u" })
    );

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      expect.objectContaining({ serviceId: focusedServiceId, slotIso: newerSlotIso }),
    ]);
    expect(created.metadata.booking_suggestion_dropped).toBeUndefined();
  });

  it("does nothing when there is no prior AI booking (first AI reply)", async () => {
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
        toolUses: [
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_first",
            input: {
              service_id: focusedServiceId,
              slot_iso: slotIso,
              reply_text: "Tuesday at 3 PM works.",
            },
          },
        ],
      },
    });
    // No prior assistant message in history — first turn.
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      ...ctxWithPriorBooking(),
      conversationHistory: [],
    });
    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "what times do you have?" })
    );

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.booking_suggestions).toEqual([
      expect.objectContaining({ serviceId: focusedServiceId, slotIso }),
    ]);
    expect(created.metadata.booking_suggestion_dropped).toBeUndefined();
  });

  it("preserves valid new slots while dropping duplicates in a multi-tool response", async () => {
    // Claude emits TWO tool blocks: one repeats Tuesday (duplicate),
    // the other proposes Wednesday (new). Loop guard should drop only
    // the Tuesday one, keep Wednesday.
    const newerSlotIso = "2026-05-13T19:00:00.000Z";
    const mocks = makeMocks({
      claudeResponse: {
        text: "",
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
            toolUseId: "tool_dup",
            input: {
              service_id: focusedServiceId,
              slot_iso: slotIso, // duplicate of prior turn
              reply_text: "Tuesday at 3 PM still open.",
            },
          },
          {
            toolName: "propose_booking_slot",
            toolUseId: "tool_new",
            input: {
              service_id: focusedServiceId,
              slot_iso: newerSlotIso,
              reply_text: "Or Wednesday at 3 PM.",
            },
          },
        ],
      },
    });
    const ctx = ctxWithPriorBooking();
    ctx.availabilitySlots.push({
      date: "2026-05-13",
      time: "15:00",
      slotIso: newerSlotIso,
      humanLabel: "Wednesday at 3:00 PM",
      serviceId: focusedServiceId,
      serviceName: "Test Service",
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctx);

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "what u sell" })
    );

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Only the new slot survives.
    expect(created.metadata.booking_suggestions).toEqual([
      expect.objectContaining({ serviceId: focusedServiceId, slotIso: newerSlotIso }),
    ]);
    expect(created.metadata.booking_suggestion_dropped).toEqual([
      "loop_guard_same_slot",
    ]);
    // The duplicate's reply_text is dropped too.
    expect(created.messageText).not.toContain("Tuesday at 3 PM still open");
    expect(created.messageText).toContain("Or Wednesday at 3 PM");
  });
});

describe("detectCrossServiceOfferFollowUp — same-anchor cross-service offer recognition", () => {
  const shopServices = [
    { serviceId: "srv_iRobot", serviceName: "I Robot" },
    { serviceId: "srv_newly", serviceName: "Newly Baker" },
  ];

  it("returns null when conversation history is empty", () => {
    expect(detectCrossServiceOfferFollowUp([], "srv_iRobot", shopServices)).toBeNull();
  });

  it("returns null when no assistant turn exists in history", () => {
    const history = [
      { role: "user", content: "hi" },
      { role: "user", content: "?" },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });

  it("returns null when the prior anchor is different (anchor-switch case)", () => {
    // Customer was anchored to Newly Baker, just switched to I Robot.
    // The focused-default filter should still fire to suppress history bias.
    const history = [
      {
        role: "assistant",
        content: "Newly Baker tutorials are 90 minutes long.",
        metadata: { anchor_service_id: "srv_newly" },
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });

  it("returns offered service when prior anchor matches AND prior text mentions a non-focused service", () => {
    // Sc1.png scenario: anchored to I Robot, AI's previous turn offered
    // Newly Baker. The customer's follow-up should be interpreted as
    // accepting Newly Baker, not the anchor.
    const history = [
      { role: "user", content: "do you sell bread?" },
      {
        role: "assistant",
        content:
          "Ha, not quite — we focus on tech, but the Newly Baker tutorial is one of our services. Want to grab a slot?",
        metadata: { anchor_service_id: "srv_iRobot" },
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toEqual({
      offeredServiceId: "srv_newly",
      offeredServiceName: "Newly Baker",
    });
  });

  it("returns null when prior anchor matches but prior text only mentions focused service", () => {
    // Normal in-thread turn — AI was just talking about I Robot, no
    // cross-service offer to follow up on.
    const history = [
      {
        role: "assistant",
        content: "I Robot is a great hands-on session. Want to book?",
        metadata: { anchor_service_id: "srv_iRobot" },
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });

  it("returns null when prior assistant has no metadata at all", () => {
    // No way to know which anchor the prior turn was on — conservative
    // default keeps the existing behavior.
    const history = [
      {
        role: "assistant",
        content: "Want to check out Newly Baker?",
        metadata: undefined,
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });

  it("falls back to booking_suggestions[0].serviceId when anchor_service_id is missing (legacy data)", () => {
    // Legacy assistant rows pre-dating anchor_service_id can still be
    // disambiguated when a single booking_suggestion is present.
    const history = [
      {
        role: "assistant",
        content: "Newly Baker is one of our services too. Want to try?",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_iRobot", slotIso: "2026-05-14T14:00:00.000Z" },
          ],
        },
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toEqual({
      offeredServiceId: "srv_newly",
      offeredServiceName: "Newly Baker",
    });
  });

  it("returns null when legacy booking_suggestions split across multiple services (ambiguous)", () => {
    // Multi-service tool blocks — without anchor_service_id we cannot
    // tell what the anchor was, so don't make assumptions.
    const history = [
      {
        role: "assistant",
        content: "Newly Baker is one of our services.",
        metadata: {
          booking_suggestions: [
            { serviceId: "srv_iRobot", slotIso: "2026-05-14T14:00:00.000Z" },
            { serviceId: "srv_newly", slotIso: "2026-05-15T10:00:00.000Z" },
          ],
        },
      },
    ];
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });

  it("walks past user messages to find the most-recent assistant turn", () => {
    // History: [assistant offer, user reply, assistant follow-up, user reply].
    // Only the MOST RECENT assistant counts (the follow-up). If the
    // follow-up didn't mention a non-focused service, return null.
    const history = [
      {
        role: "assistant",
        content: "We also have Newly Baker — want to try?",
        metadata: { anchor_service_id: "srv_iRobot" },
      },
      { role: "user", content: "how long?" },
      {
        role: "assistant",
        content: "About 90 minutes.",
        metadata: { anchor_service_id: "srv_iRobot" },
      },
      { role: "user", content: "ok" },
    ];
    // The most recent assistant ("About 90 minutes.") mentions no service
    // name, so the cross-service follow-up window is closed.
    expect(detectCrossServiceOfferFollowUp(history, "srv_iRobot", shopServices)).toBeNull();
  });
});

describe("AgentOrchestrator — cross-service offer follow-up integration", () => {
  // sc1.png repro: anchored to I Robot. AI's prior turn offered Newly
  // Baker in plain text ("…the Newly Baker tutorial is one of our
  // services — want to grab a slot?"). Customer's follow-up is "yes
  // please". Without the fix: focused-default filter strips Newly
  // Baker's slots and the active-topic reminder tells Claude to stay
  // on I Robot, so Claude can't book Newly Baker. With the fix: the
  // filter is bypassed and the reminder is suppressed.

  const focusedServiceId = "srv_test"; // matches sampleInput's serviceId
  const otherServiceId = "srv_newly";
  const focusedSlotIso = "2026-05-14T13:00:00.000Z";
  const otherSlotIso = "2026-05-14T14:00:00.000Z";

  const ctxWithCrossServiceOffer = () => ({
    service: {
      serviceId: focusedServiceId,
      serviceName: "I Robot",
      priceUsd: 699.99,
      category: "tech",
      description: "Build your own robot.",
      bookingAssistance: true,
      suggestUpsells: true,
      faqEntries: [],
    },
    customer: {
      address: "0xabc",
      name: "Tester",
      tier: "BRONZE",
      rcnBalance: 0,
      joinedAt: null,
    },
    shop: {
      shopId: "shop_test",
      shopName: "Peanut",
      category: "tech",
      hoursSummary: null,
      timezone: null,
    },
    // Prior AI turn offered Newly Baker (a non-focused service) and was
    // operating under the same I Robot anchor as the current turn.
    conversationHistory: [
      { role: "user", content: "do you sell bread?", createdAt: new Date() },
      {
        role: "assistant",
        content:
          "Ha, not quite! We're a Repairs and Tech shop. The Newly Baker baking tutorial is one of our services though — want to grab a slot?",
        createdAt: new Date(),
        metadata: { generated_by: "ai_agent", anchor_service_id: focusedServiceId },
      },
    ],
    siblingServices: [],
    upcomingAppointments: [],

    shopServiceMenu: [
      {
        serviceId: otherServiceId,
        serviceName: "Newly Baker",
        priceUsd: 99,
        category: "baking",
        shortBlurb: null,
        bookingAssistance: true,
      },
    ],
    availabilitySlots: [
      {
        date: "2026-05-14",
        time: "09:00",
        slotIso: focusedSlotIso,
        humanLabel: "Thursday at 9:00 AM",
        serviceId: focusedServiceId,
        serviceName: "I Robot",
      },
      {
        date: "2026-05-14",
        time: "10:00",
        slotIso: otherSlotIso,
        humanLabel: "Thursday at 10:00 AM",
        serviceId: otherServiceId,
        serviceName: "Newly Baker",
      },
    ],
  });

  it("does NOT strip non-focused slots on a cross-service offer follow-up", async () => {
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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctxWithCrossServiceOffer());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "yes please" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    const svcEnum = callArgs.tools[0].inputSchema.properties.service_id.enum;
    // Both services' slots remain available — Claude can book Newly Baker.
    expect(slotEnum).toContain(focusedSlotIso);
    expect(slotEnum).toContain(otherSlotIso);
    expect(svcEnum).toContain(focusedServiceId);
    expect(svcEnum).toContain(otherServiceId);
  });

  it("injects a CROSS-SERVICE OFFER reminder pointing at the offered service", async () => {
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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctxWithCrossServiceOffer());

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "yes please" })
    );

    const messages = mocks.anthropicClient.complete.mock.calls[0][0].messages;
    // Expect: [..., assistant cross-offer reminder, user "yes please"]    expect(messages.length).toBeGreaterThanOrEqual(2);
    const lastTwo = messages.slice(-2);
    expect(lastTwo[0].role).toBe("assistant");
    // Reminder must reference the OFFERED service, not the anchor.
    expect(lastTwo[0].content).toMatch(/offered "Newly Baker"/);
    expect(lastTwo[0].content).toMatch(/service_id="srv_newly"/);
    expect(lastTwo[0].content).toMatch(/CALL propose_booking_slot/);
    // Reminder should NOT be the anchor flavor.
    expect(lastTwo[0].content).not.toMatch(/^.{0,200}anchored to "I Robot"/);
    expect(lastTwo[1]).toEqual({ role: "user", content: "yes please" });
  });

  it("DOES strip slots and inject reminder on anchor-switch (different prior anchor)", async () => {
    // Anchor changed: prior turn's anchor was the OTHER service, customer
    // now in focused. Existing focused-default behavior should apply —
    // strip non-focused slots, fire the reminder.
    const ctx = ctxWithCrossServiceOffer();
    // Override the prior assistant's anchor to differ from current.
    ctx.conversationHistory[1] = {
      ...ctx.conversationHistory[1],
      metadata: { generated_by: "ai_agent", anchor_service_id: otherServiceId },
    };

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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctx);

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "what's the price?" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    // Only the focused service's slot remains — anchor-switch path.
    expect(slotEnum).toEqual([focusedSlotIso]);

    const messages = callArgs.messages;
    // Reminder IS present — anchor-switch case still gets the active-topic note.
    const assistantContents = messages
      .filter((m: any) => m.role === "assistant")
      .map((m: any) => m.content);
    expect(assistantContents.some((c: string) => /anchored to "I Robot"/.test(c))).toBe(true);
  });

  it("DOES strip slots when prior turn mentioned only the focused service (normal in-thread)", async () => {
    // No cross-service offer in the prior turn — should behave like a
    // normal anchored conversation.
    const ctx = ctxWithCrossServiceOffer();
    ctx.conversationHistory[1] = {
      ...ctx.conversationHistory[1],
      content: "I Robot is a 4-hour hands-on session. Want a time?",
    };

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
        toolUses: [],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue(ctx);

    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "yes please" })
    );

    const callArgs = mocks.anthropicClient.complete.mock.calls[0][0];
    const slotEnum = callArgs.tools[0].inputSchema.properties.slot_iso.enum;
    // Existing behavior: focused-default filter strips non-focused slot.
    expect(slotEnum).toEqual([focusedSlotIso]);
  });

  it("stamps anchor_service_id onto AI message metadata for downstream turns", async () => {
    const mocks = makeMocks();
    await mocks.orch.handleCustomerMessage(sampleInput());

    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    expect(created.metadata.anchor_service_id).toBe("srv_test");
  });
});

describe("isLikelyDuplicateText — near-duplicate string detection", () => {
  it("returns true for the observed staging duplicate (closest match / closest we've got)", () => {
    // Exact pair captured from sc1.png on 5/13. Claude emitted both as a
    // text block + tool reply_text. The orchestrator's exact-string
    // dedup missed it and the customer saw both lines stacked.
    const a = "Friday at 3:30 PM is the closest match — tap below to lock it in! 🎯";
    const b = "Friday at 3:30 PM is the closest we've got — tap below to lock it in! 🎯";
    expect(isLikelyDuplicateText(a, b)).toBe(true);
  });

  it("returns true for byte-identical strings", () => {
    const s = "Thursday at 2:00 PM works — tap below.";
    expect(isLikelyDuplicateText(s, s)).toBe(true);
  });

  it("returns true when one string is a near-superset (extra filler word)", () => {
    expect(
      isLikelyDuplicateText(
        "Friday at 2:00 PM works — tap below.",
        "Friday at 2:00 PM works perfectly — tap below."
      )
    ).toBe(true);
  });

  it("returns false for the legitimate multi-service combination", () => {
    // The multi-service pattern that DOES add new info — must survive.
    const extraText =
      "For the laptop repair (AQua Tech), you'll need to book that through their service page separately. Want me to flag a teammate to coordinate both?";
    const replyText = "For the pastry tutorial — Friday at 2 PM works! Tap below.";
    expect(isLikelyDuplicateText(extraText, replyText)).toBe(false);
  });

  it("returns false when extra adds a distinct preamble (legit setup + propose)", () => {
    const extraText = "Here's a great pick that lines up with your morning preference:";
    const replyText = "Thursday at 9:00 AM works — tap below.";
    expect(isLikelyDuplicateText(extraText, replyText)).toBe(false);
  });

  it("returns false for very short strings (avoid suppressing confirmations)", () => {
    expect(isLikelyDuplicateText("Sure!", "Thursday at 2 PM works — tap below.")).toBe(false);
    expect(isLikelyDuplicateText("Got it.", "Thursday at 2 PM works — tap below.")).toBe(false);
    expect(isLikelyDuplicateText("Great!", "Friday at 9 AM is open.")).toBe(false);
  });

  it("returns false on empty / non-string inputs", () => {
    expect(isLikelyDuplicateText("", "anything")).toBe(false);
    expect(isLikelyDuplicateText("anything", "")).toBe(false);
    expect(isLikelyDuplicateText(null as any, "anything")).toBe(false);
    expect(isLikelyDuplicateText("anything", undefined as any)).toBe(false);
  });

  it("returns false for short strings sharing only a single keyword", () => {
    // "Tuesday" appears in both but the rest is different — not a dup.
    expect(
      isLikelyDuplicateText("Tuesday is generally our quietest day.", "Tuesday at 3 PM works.")
    ).toBe(false);
  });

  it("ignores punctuation, emoji, and case differences", () => {
    expect(
      isLikelyDuplicateText(
        "Friday at 2:00 PM works — tap below!",
        "FRIDAY AT 2:00 PM works   tap below 🎯🎯🎯"
      )
    ).toBe(true);
  });
});

describe("AgentOrchestrator — near-duplicate extraText suppression", () => {
  // Replay of sc1.png: anchor I Robot, customer asked "how about friday
  // 3pm?". Claude returned ONE tool_use (reply_text "Friday at 3:30 PM
  // is the closest we've got — tap below") AND a text block ("Friday at
  // 3:30 PM is the closest match — tap below"). The orchestrator
  // should suppress the text block as near-duplicate.

  const slotIso = "2026-05-15T19:30:00.000Z";

  const buildMocks = () => {
    const mocks = makeMocks({
      claudeResponse: {
        text: "Friday at 3:30 PM is the closest match — tap below to lock it in! 🎯",
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
            toolUseId: "tool_dup",
            input: {
              service_id: "srv_test",
              slot_iso: slotIso,
              reply_text:
                "Friday at 3:30 PM is the closest we've got — tap below to lock it in! 🎯",
            },
          },
        ],
      },
    });
    mocks.contextBuilder.build = jest.fn().mockResolvedValue({
      service: {
        serviceId: "srv_test",
        serviceName: "I Robot",
        priceUsd: 699.99,
        category: "tech",
        description: "test",
        bookingAssistance: true,
        suggestUpsells: false,
        faqEntries: [],
      },
      customer: { address: "0xabc", name: "Tester", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: {
        shopId: "shop_test",
        shopName: "Peanut",
        category: "tech",
        hoursSummary: null,
        timezone: null,
      },
      conversationHistory: [],
      siblingServices: [],
      upcomingAppointments: [],

      shopServiceMenu: [],
      availabilitySlots: [
        {
          date: "2026-05-15",
          time: "15:30",
          slotIso,
          humanLabel: "Friday at 3:30 PM",
          serviceId: "srv_test",
          serviceName: "I Robot",
        },
      ],
    });
    return mocks;
  };

  it("drops the extra text block when it nearly duplicates the tool reply_text", async () => {
    const mocks = buildMocks();
    await mocks.orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "how about friday 3pm?" })
    );
    const created = mocks.messageRepo.createMessage.mock.calls[0][0];
    // Only one variant survives — the tool's reply_text. The text-block
    // duplicate is suppressed.
    expect(created.messageText).toBe(
      "Friday at 3:30 PM is the closest we've got — tap below to lock it in! 🎯"
    );
    // Both phrasings should NOT be present together.
    expect(created.messageText).not.toContain("closest match");
    // The tap card still lands.
    expect(created.metadata.booking_suggestions).toEqual([
      expect.objectContaining({ serviceId: "srv_test", slotIso }),
    ]);
  });
});

describe("resolveDiscussedServiceId — chip dynamic update policy", () => {
  // Drives the frontend "Currently discussing" chip. Policy: tool call wins
  // > single-service text mention > carry forward previous AI turn's value
  // > anchor fallback. Designed so short replies ("thanks", "ok") don't
  // snap the chip back to the anchor mid-conversation.

  const services = [
    { serviceId: "srv_aqua", serviceName: "AQua Tech" },
    { serviceId: "srv_robot", serviceName: "I Robot" },
    { serviceId: "srv_baker", serviceName: "Newly Baker" },
  ];
  const anchorServiceId = "srv_aqua";

  it("tool-call serviceId wins over text mentions and prior history", () => {
    const out = resolveDiscussedServiceId(
      [{ serviceId: "srv_robot" }, { serviceId: "srv_baker" }],
      "Booked you for AQua Tech!", // mentions anchor — should still lose to tool call
      services,
      [],
      anchorServiceId
    );
    expect(out).toBe("srv_robot"); // first tool call's service
  });

  it("multi-tool turn pins to the FIRST tool call (the lead service)", () => {
    const out = resolveDiscussedServiceId(
      [
        { serviceId: "srv_baker" },
        { serviceId: "srv_robot" },
        { serviceId: "srv_aqua" },
      ],
      "Two bookings coming up!",
      services,
      [],
      anchorServiceId
    );
    expect(out).toBe("srv_baker");
  });

  it("falls through to text mention when bookingSuggestions is empty", () => {
    const out = resolveDiscussedServiceId(
      [],
      "Sure! Here's what you need to know about I Robot — full kit included.",
      services,
      [],
      anchorServiceId
    );
    expect(out).toBe("srv_robot");
  });

  it("treats multi-service text mentions as ambiguous and carries forward", () => {
    // Polite catch-all reply: "happy to help with AQua Tech or I Robot."
    // Two services named → ambiguous → carry forward instead of guessing.
    const history = [
      {
        role: "assistant",
        metadata: { discussed_service_id: "srv_robot" },
      },
    ];
    const out = resolveDiscussedServiceId(
      [],
      "You're welcome! Whether it's AQua Tech or I Robot, happy to help.",
      services,
      history,
      anchorServiceId
    );
    expect(out).toBe("srv_robot");
  });

  it("carries forward the prior AI turn's value on a generic reply", () => {
    // "thanks" → "you're welcome" — no service named, prior turn was about
    // I Robot. Chip must stay on I Robot, not snap back to anchor.
    const history = [
      {
        role: "assistant",
        metadata: { discussed_service_id: "srv_robot" },
      },
      { role: "user", metadata: undefined },
    ];
    const out = resolveDiscussedServiceId(
      [],
      "You're welcome! Let me know if you need anything else.",
      services,
      history,
      anchorServiceId
    );
    expect(out).toBe("srv_robot");
  });

  it("walks past pre-deploy AI turns lacking discussed_service_id", () => {
    // Migration case: older AI messages don't carry the field yet. Walk
    // back until we find one that does. If none → anchor fallback.
    const history = [
      {
        role: "assistant",
        metadata: { discussed_service_id: "srv_baker" }, // oldest with field
      },
      { role: "user", metadata: undefined },
      {
        role: "assistant",
        metadata: { generated_by: "ai_agent" }, // pre-deploy, no field
      },
      { role: "user", metadata: undefined },
    ];
    const out = resolveDiscussedServiceId(
      [],
      "ok",
      services,
      history,
      anchorServiceId
    );
    expect(out).toBe("srv_baker");
  });

  it("falls back to anchor on the first AI reply", () => {
    // Empty history → no prior turn to carry forward from. Anchor wins.
    const out = resolveDiscussedServiceId(
      [],
      "Hi! Welcome.",
      services,
      [],
      anchorServiceId
    );
    expect(out).toBe(anchorServiceId);
  });

  it("falls back to anchor when no prior AI turn carries the field", () => {
    const history = [
      { role: "user", metadata: undefined },
      { role: "user", metadata: undefined },
    ];
    const out = resolveDiscussedServiceId(
      [],
      "ok",
      services,
      history,
      anchorServiceId
    );
    expect(out).toBe(anchorServiceId);
  });

  it("ignores empty/whitespace reply text and uses carry-forward", () => {
    const history = [
      {
        role: "assistant",
        metadata: { discussed_service_id: "srv_robot" },
      },
    ];
    expect(
      resolveDiscussedServiceId([], "   ", services, history, anchorServiceId)
    ).toBe("srv_robot");
    expect(
      resolveDiscussedServiceId([], "", services, history, anchorServiceId)
    ).toBe("srv_robot");
  });

  it("ignores tool-call entries missing serviceId defensively", () => {
    // Resolver shouldn't index into a serviceId-less entry — that would
    // stamp `undefined` onto the metadata field and break the chip.
    const history = [
      {
        role: "assistant",
        metadata: { discussed_service_id: "srv_robot" },
      },
    ];
    const out = resolveDiscussedServiceId(
      [{} as any, { serviceId: "srv_baker" }],
      "",
      services,
      history,
      anchorServiceId
    );
    // First entry has no serviceId → step 1 doesn't fire → step 3 carries
    // forward to srv_robot. (Step 1 doesn't fall through to the second
    // entry — that's intentional, "first call wins or skip" semantics.)
    expect(out).toBe("srv_robot");
  });
});

// (Removed in Phase 2) The toMillis + findMostRecentHumanShopMessage
// unit tests and the AgentOrchestrator — human takeover skip integration
// tests have been replaced by the AgentOrchestrator — ai_paused skip
// suite below. Phase 2 moved the takeover decision from a history-based
// heuristic to a persistent conversations.ai_paused_until column —
// single source of truth for both the 30s auto race window and the
// indefinite "Take Over" hold. See migration 114 + docs/tasks/strategy/
// ai-human-handoff-clash.md.

describe("AgentOrchestrator — ai_paused skip (Phase 2 human handoff)", () => {
  // Replaces the time-window heuristic with a single DB-column check.
  // The orchestrator reads conversations.ai_paused_until in the prefilter
  // and skips when the timestamp is in the future. Two write paths feed
  // this column (auto race window on shop msg + explicit takeover button)
  // but the read path is identical for both.

  it("skips with reason ai_paused when ai_paused_until is in the future", async () => {
    const future = new Date(Date.now() + 25 * 1000); // 25s ahead (mimics auto window)
    const { orch, messageRepo, auditLogger, anthropicClient } = makeMocks({
      aiPausedUntil: future,
    });
    const result = await orch.handleCustomerMessage(sampleInput());

    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("ai_paused");
    }
    // No Claude call. No AI message inserted.
    expect(anthropicClient.complete).not.toHaveBeenCalled();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
    // Audit row written with reason: 'ai_paused' + pausedUntil snapshot.
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    const audit = auditLogger.log.mock.calls[0][0];
    expect(audit.escalatedToHuman).toBe(false);
    expect(audit.errorMessage).toBeNull();
    expect(audit.responsePayload).toBeNull();
    expect((audit.requestPayload as any).reason).toBe("ai_paused");
    expect((audit.requestPayload as any).pausedUntil).toBe(future.toISOString());
  });

  it("skips also when ai_paused_until is far in the future (takeover mode)", async () => {
    // 100 years out — the explicit takeover button's value.
    const farFuture = new Date(Date.now() + 100 * 365.25 * 24 * 3600 * 1000);
    const { orch, anthropicClient } = makeMocks({ aiPausedUntil: farFuture });
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("skipped");
    if (result.outcome === "skipped") {
      expect(result.reason).toBe("ai_paused");
    }
    expect(anthropicClient.complete).not.toHaveBeenCalled();
  });

  it("fires normally when ai_paused_until is NULL (AI active)", async () => {
    const { orch, anthropicClient } = makeMocks({ aiPausedUntil: null });
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
    expect(anthropicClient.complete).toHaveBeenCalled();
  });

  it("fires normally when ai_paused_until is in the past (expired auto window)", async () => {
    // 10 seconds ago — the auto window just elapsed.
    const past = new Date(Date.now() - 10 * 1000);
    const { orch, anthropicClient } = makeMocks({ aiPausedUntil: past });
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
    expect(anthropicClient.complete).toHaveBeenCalled();
  });

  it("does NOT consult conversation history for the pause decision", async () => {
    // Phase 1 heuristic looked at the history's most recent shop message.
    // Phase 2 doesn't — only ai_paused_until counts. Verify by giving
    // the test a history full of recent non-AI shop messages BUT with
    // ai_paused_until = NULL → AI must still fire.
    const recentNonAiHistory = [
      {
        role: "assistant",
        content: "human shop staff typing here",
        createdAt: new Date(Date.now() - 5 * 60_000),
        // No metadata.generated_by — would have triggered the old heuristic.
      },
    ];
    const { orch, anthropicClient } = makeMocks({
      aiPausedUntil: null,
      contextHistory: recentNonAiHistory,
    });
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
    expect(anthropicClient.complete).toHaveBeenCalled();
  });
});



describe("PromptTemplates rule #9 — current-message-only disclosure (Bug B fix)", () => {
  // Bug B from the AI/human handoff strategy: AI volunteered "I'm an AI"
  // when the customer's CURRENT message didn't ask, because earlier
  // history contained "real human here". Rule #9 now requires the
  // CURRENT message to ask, with explicit anti-history-inference language
  // and negative few-shot examples.
  const path = require("path");
  // Lazy require so this describe block doesn't import PromptTemplates
  // at the top of the file (which would force coverage tooling to do
  // extra work even for unrelated test runs).
  it("explicitly anchors the disclosure rule to the CURRENT message", () => {
    const { friendlyPrompt } = require(
      "../../src/domains/AIAgentDomain/services/PromptTemplates"
    );
    // Minimal ctx — only the bits the template reads to build rules.
    const ctx = {
      service: {
        serviceId: "srv",
        serviceName: "Test",
        description: "",
        priceUsd: 10,
        category: "test",
        bookingAssistance: false,
        suggestUpsells: false,
        faqEntries: [],
      },
      customer: { address: "0xabc", name: "Cust", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: {
        shopId: "s",
        shopName: "Shop",
        category: "test",
        hoursSummary: null,
        timezone: null,
        bookingAdvanceDays: null,
        minBookingHours: null,
        reschedulesAllowed: null,
        maxReschedulesPerBooking: null,
        rescheduleMinHours: null,
        cancellationMinHours: null,
        address: null,
        phone: null,
        email: null,
        website: null,
      },
      conversationHistory: [],
      siblingServices: [],
      upcomingAppointments: [],

      shopServiceMenu: [],
      availabilitySlots: [],
    };
    const prompt = friendlyPrompt(ctx);
    expect(prompt).toMatch(/in their CURRENT message/);
    expect(prompt).toMatch(/Never volunteer your AI identity/i);
    expect(prompt).toMatch(/Do NOT infer the question from history/i);
  });

  it("includes the negative few-shot examples that anchor the fix to its trigger scenario", () => {
    const { professionalPrompt } = require(
      "../../src/domains/AIAgentDomain/services/PromptTemplates"
    );
    const ctx = {
      service: {
        serviceId: "srv",
        serviceName: "Test",
        description: "",
        priceUsd: 10,
        category: "test",
        bookingAssistance: false,
        suggestUpsells: false,
        faqEntries: [],
      },
      customer: { address: "0xabc", name: "Cust", tier: "BRONZE", rcnBalance: 0, joinedAt: null },
      shop: {
        shopId: "s",
        shopName: "Shop",
        category: "test",
        hoursSummary: null,
        timezone: null,
        bookingAdvanceDays: null,
        minBookingHours: null,
        reschedulesAllowed: null,
        maxReschedulesPerBooking: null,
        rescheduleMinHours: null,
        cancellationMinHours: null,
        address: null,
        phone: null,
        email: null,
        website: null,
      },
      conversationHistory: [],
      siblingServices: [],
      upcomingAppointments: [],

      shopServiceMenu: [],
      availabilitySlots: [],
    };
    const prompt = professionalPrompt(ctx);
    // The "real human here" history scenario specifically.
    expect(prompt).toMatch(/real human here/);
    expect(prompt).toMatch(/im looking for bread training/);
  });
});

describe("AgentOrchestrator — propose_cancellation + propose_reschedule_request (Phase 2.6-2.12)", () => {
  // Helper: stub a context with one upcoming appointment + one availability
  // slot so both propose-* tools are present, plus a Claude response carrying
  // whatever tool_use blocks the test wants to exercise.
  const ORDER_A = "ord_aaaaaaaa1111";
  const ORDER_B = "ord_bbbbbbbb2222";
  const SLOT_ISO_A = "2026-06-05T18:00:00.000Z";
  const SLOT_ISO_OTHER_SERVICE = "2026-06-06T18:00:00.000Z";

  const buildCtxOverride = (overrides: any = {}) => ({
    service: {
      serviceId: "srv_test",
      serviceName: "Test Service",
      priceUsd: 50,
      category: "test",
      description: "test",
      customInstructions: null,
      bookingAssistance: true,
      suggestUpsells: false,
      faqEntries: [],
    },
    customer: {
      address: "0xabc",
      name: "Test",
      tier: "BRONZE",
      rcnBalance: 0,
      joinedAt: null,
    },
    shop: {
      shopId: "shop_test",
      shopName: "Test Shop",
      category: "test",
      hoursSummary: null,
      timezone: null,
    },
    conversationHistory: [],
    siblingServices: [],
    shopServiceMenu: [],
    availabilitySlots: [
      {
        date: "2026-06-05",
        time: "14:00",
        slotIso: SLOT_ISO_A,
        humanLabel: "Friday at 2:00 PM",
        serviceId: "srv_test",
        serviceName: "Test Service",
      },
      {
        date: "2026-06-06",
        time: "14:00",
        slotIso: SLOT_ISO_OTHER_SERVICE,
        humanLabel: "Saturday at 2:00 PM",
        serviceId: "srv_other",
        serviceName: "Other Service",
      },
    ],
    upcomingAppointments: [
      {
        orderId: ORDER_A,
        serviceId: "srv_test",
        serviceName: "Test Service",
        bookingDate: "2026-06-10",
        bookingTime: "10:00",
        status: "paid",
        withinCancellationWindow: true,
        pendingRescheduleRequestId: null,
      },
    ],
    ...overrides,
  });

  const buildMocks = (toolUses: any[], ctxOverrides: any = {}) => {
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
        toolUses,
      },
    });
    mocks.contextBuilder.build = jest
      .fn()
      .mockResolvedValue(buildCtxOverride(ctxOverrides));
    return mocks;
  };

  it("happy path — propose_cancellation emits a CancellationProposal in message metadata", async () => {
    const { orch, messageRepo } = buildMocks([
      {
        toolName: "propose_cancellation",
        toolUseId: "tool_cancel_1",
        input: {
          order_id: ORDER_A,
          reply_text: "Cancel Test Service on June 10? Tap to confirm.",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    expect(callArgs.metadata.cancellation_proposals).toBeDefined();
    expect(callArgs.metadata.cancellation_proposals).toHaveLength(1);
    expect(callArgs.metadata.cancellation_proposals[0]).toMatchObject({
      orderId: ORDER_A,
      serviceId: "srv_test",
      serviceName: "Test Service",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      withinCancellationWindow: true,
    });
    // No reschedule or booking metadata on a pure-cancel turn.
    expect(callArgs.metadata.booking_suggestions).toBeUndefined();
    expect(callArgs.metadata.reschedule_proposals).toBeUndefined();
  });

  it("happy path — propose_reschedule_request emits a RescheduleProposal in message metadata", async () => {
    const { orch, messageRepo } = buildMocks([
      {
        toolName: "propose_reschedule_request",
        toolUseId: "tool_resched_1",
        input: {
          order_id: ORDER_A,
          requested_slot_iso: SLOT_ISO_A,
          reply_text: "Move Test Service to Friday at 2 PM? Tap to send.",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    expect(callArgs.metadata.reschedule_proposals).toBeDefined();
    expect(callArgs.metadata.reschedule_proposals).toHaveLength(1);
    expect(callArgs.metadata.reschedule_proposals[0]).toMatchObject({
      orderId: ORDER_A,
      serviceId: "srv_test",
      serviceName: "Test Service",
      currentBookingDate: "2026-06-10",
      currentBookingTime: "10:00",
      requestedDate: "2026-06-05",
      requestedTime: "14:00",
      requestedLabel: "Friday at 2:00 PM",
    });
  });

  it("rejects propose_cancellation when the appointment is within the 24h window", async () => {
    const { orch, messageRepo } = buildMocks(
      [
        {
          toolName: "propose_cancellation",
          toolUseId: "tool_cancel_1",
          input: {
            order_id: ORDER_A,
            reply_text: "Cancel today's slot?",
          },
        },
      ],
      {
        upcomingAppointments: [
          {
            orderId: ORDER_A,
            serviceId: "srv_test",
            serviceName: "Test Service",
            bookingDate: "2026-05-26",
            bookingTime: "09:00",
            status: "paid",
            withinCancellationWindow: false, // ← within 24h
            pendingRescheduleRequestId: null,
          },
        ],
      }
    );
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    expect(callArgs.metadata.cancellation_proposals).toBeUndefined();
    expect(callArgs.metadata.cancellation_proposal_dropped).toContain(
      "cancellation_tool_within_24h_window"
    );
  });

  it("rejects propose_reschedule_request when a pending request already exists", async () => {
    const { orch, messageRepo } = buildMocks(
      [
        {
          toolName: "propose_reschedule_request",
          toolUseId: "tool_resched_1",
          input: {
            order_id: ORDER_A,
            requested_slot_iso: SLOT_ISO_A,
            reply_text: "Reschedule to Friday at 2 PM?",
          },
        },
      ],
      {
        upcomingAppointments: [
          {
            orderId: ORDER_A,
            serviceId: "srv_test",
            serviceName: "Test Service",
            bookingDate: "2026-06-10",
            bookingTime: "10:00",
            status: "paid",
            withinCancellationWindow: true,
            pendingRescheduleRequestId: "req_already_pending", // ← Q2 path
          },
        ],
      }
    );
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    expect(callArgs.metadata.reschedule_proposals).toBeUndefined();
    expect(callArgs.metadata.reschedule_proposal_dropped).toContain(
      "reschedule_tool_pending_request_exists"
    );
  });

  it("rejects propose_reschedule_request when the slot belongs to a different service", async () => {
    const { orch, messageRepo } = buildMocks([
      {
        toolName: "propose_reschedule_request",
        toolUseId: "tool_resched_1",
        input: {
          order_id: ORDER_A,
          requested_slot_iso: SLOT_ISO_OTHER_SERVICE, // ← srv_other, not srv_test
          reply_text: "Reschedule to Saturday at 2 PM?",
        },
      },
    ]);
    // The customer message names "Test Service" so the orchestrator's
    // focused-default filter (AgentOrchestrator.ts:348-370) doesn't strip
    // the other-service slot from availabilitySlots before dispatch — we
    // want the server-side service-mismatch check at the reschedule
    // dispatch to be the one that fires.
    await orch.handleCustomerMessage(
      sampleInput({ customerMessageText: "I want to reschedule my Test Service appointment" })
    );

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    expect(callArgs.metadata.reschedule_proposals).toBeUndefined();
    expect(callArgs.metadata.reschedule_proposal_dropped).toContain(
      "reschedule_tool_service_mismatch"
    );
  });

  it("multi-call guard — drops the booking suggestion when a cancellation lands in the same turn", async () => {
    const { orch, messageRepo } = buildMocks([
      {
        toolName: "propose_booking_slot",
        toolUseId: "tool_book_1",
        input: {
          service_id: "srv_test",
          slot_iso: SLOT_ISO_A,
          reply_text: "Friday at 2 PM works.",
        },
      },
      {
        toolName: "propose_cancellation",
        toolUseId: "tool_cancel_1",
        input: {
          order_id: ORDER_A,
          reply_text: "Cancel Test Service on June 10? Tap to confirm.",
        },
      },
    ]);
    await orch.handleCustomerMessage(sampleInput());

    const callArgs = messageRepo.createMessage.mock.calls[0][0];
    // Cancellation wins (destructive action stands alone).
    expect(callArgs.metadata.cancellation_proposals).toHaveLength(1);
    // Booking was dropped + reason logged.
    expect(callArgs.metadata.booking_suggestions).toBeUndefined();
    expect(callArgs.metadata.booking_suggestion_dropped).toContain(
      "dropped_for_destructive_action_in_same_turn"
    );
  });
});

describe("AgentOrchestrator — AI Auto-Replies tier gate (WS2)", () => {
  const original = process.env.ENFORCE_AI_AUTOREPLY_TIER;
  afterEach(() => {
    if (original === undefined) delete process.env.ENFORCE_AI_AUTOREPLY_TIER;
    else process.env.ENFORCE_AI_AUTOREPLY_TIER = original;
    mockShopHasFeature.mockResolvedValue(true);
  });

  it("skips the auto-reply when the flag is ON and the plan lacks aiAutoReplies", async () => {
    process.env.ENFORCE_AI_AUTOREPLY_TIER = "true";
    mockShopHasFeature.mockResolvedValue(false);
    const { orch, messageRepo } = makeMocks();
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result).toEqual({ outcome: "skipped", reason: "autoreply_tier_not_included" });
    expect(messageRepo.createMessage).not.toHaveBeenCalled(); // no AI reply posted
  });

  it("does NOT gate when the flag is OFF (default) — auto-reply still fires below tier", async () => {
    delete process.env.ENFORCE_AI_AUTOREPLY_TIER;
    mockShopHasFeature.mockResolvedValue(false);
    const { orch } = makeMocks();
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
  });

  it("allows the auto-reply when the flag is ON and the plan includes aiAutoReplies", async () => {
    process.env.ENFORCE_AI_AUTOREPLY_TIER = "true";
    mockShopHasFeature.mockResolvedValue(true);
    const { orch } = makeMocks();
    const result = await orch.handleCustomerMessage(sampleInput());
    expect(result.outcome).toBe("ai_replied");
  });
});
