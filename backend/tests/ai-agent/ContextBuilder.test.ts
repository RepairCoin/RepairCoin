// backend/tests/ai-agent/ContextBuilder.test.ts
//
// Unit tests for ContextBuilder. Mocks all four repositories so no DB hits.
// Verifies:
//   - Parallel fetch from all four repositories
//   - Mapping from raw rows → AgentContext shape
//   - Throws on missing service / customer / shop
//   - Honors aiSuggestUpsells flag (skips siblings query if false)
//   - Caps conversation history at MAX_CONVERSATION_MESSAGES
//   - Caps siblings at MAX_SIBLING_SERVICES
//   - Filters out the "current" service from siblings

import { ContextBuilder } from "../../src/domains/AIAgentDomain/services/ContextBuilder";

describe("ContextBuilder", () => {
  const baseService = (overrides: any = {}) => ({
    serviceId: "srv_main",
    shopId: "peanut",
    serviceName: "Oil Change",
    description: "Standard oil change.",
    priceUsd: 89.99,
    durationMinutes: 30,
    category: "automotive",
    aiSalesEnabled: true,
    aiTone: "professional",
    aiSuggestUpsells: false,
    aiBookingAssistance: true,
    aiCustomInstructions: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const baseCustomer = (overrides: any = {}) => ({
    address: "0xabc123",
    name: "Lee Chun Nan",
    tier: "BRONZE",
    currentBalance: 50,
    joinDate: new Date("2026-04-01"),
    ...overrides,
  });

  const baseShop = (overrides: any = {}) => ({
    shopId: "peanut",
    name: "Peanut Auto",
    category: "automotive",
    timezone: "America/Chicago",
    ...overrides,
  });

  // getRecentConversationMessages returns a plain Message[] (oldest-first),
  // not a paginated { items, pagination } envelope.
  const baseMessages = (count = 0) =>
    Array.from({ length: count }, (_, i) => ({
      conversationId: "conv_xxx",
      content: `message ${i + 1}`,
      senderType: i % 2 === 0 ? "customer" : "shop",
      createdAt: new Date(Date.now() + i * 1000),
    }));

  function makeMocks(opts: {
    service?: any;
    customer?: any;
    shop?: any;
    messageCount?: number;
    siblingServices?: any[];
    /** FAQ entries returned by ServiceAIFaqRepository.getEntriesForService. */
    faqEntries?: Array<{ question: string; answer: string }>;
    /** Rows returned by the pool.query stub for shop_availability (Phase 3 follow-up). */
    weeklyHoursRows?: Array<{
      day_of_week: number;
      is_open: boolean;
      open_time: string | null;
      close_time: string | null;
      break_start_time?: string | null;
      break_end_time?: string | null;
    }>;
  } = {}) {
    const serviceRow = opts.service !== undefined ? opts.service : baseService();
    const customerRow = opts.customer !== undefined ? opts.customer : baseCustomer();
    const shopRow = opts.shop !== undefined ? opts.shop : baseShop();
    const messages = baseMessages(opts.messageCount ?? 0);
    const siblings = opts.siblingServices ?? [];

    const mockCustomerRepo = { getCustomer: jest.fn().mockResolvedValue(customerRow) };
    const mockShopRepo = { getShop: jest.fn().mockResolvedValue(shopRow) };
    const mockServiceRepo = {
      getServiceById: jest.fn().mockResolvedValue(serviceRow),
      getServicesByShop: jest.fn().mockResolvedValue({ items: siblings, pagination: {} }),
    };
    const mockMessageRepo = {
      getRecentConversationMessages: jest.fn().mockResolvedValue(messages),
    };
    // AvailabilityFetcher mock — no slots needed for these unit tests; the
    // booking-card flow has its own dedicated AvailabilityFetcher tests.
    // Phase 2 of multi-service architecture: ContextBuilder now calls
    // fetchUpcomingSlotsForServices (the multi-service variant) instead of
    // fetchUpcomingSlots. Mock both so the spy works regardless of which
    // method the implementation chooses today.
    const mockAvailabilityFetcher = {
      fetchUpcomingSlots: jest.fn().mockResolvedValue([]),
      fetchUpcomingSlotsForServices: jest.fn().mockResolvedValue([]),
    };
    // Pool mock — fetchWeeklyHours queries shop_availability via a raw
    // pool.query. Default to empty rows; tests targeting the hours
    // summarizer pass a custom mock via opts.weeklyHoursRows.
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: opts.weeklyHoursRows ?? [] }),
    };
    // FAQ repo mock — empty by default. Tests for the FAQ rendering path
    // override the mock value via opts.faqEntries.
    const mockFaqRepo = {
      getEntriesForService: jest.fn().mockResolvedValue(opts.faqEntries ?? []),
    };

    const builder = new ContextBuilder(
      mockCustomerRepo as any,
      mockShopRepo as any,
      mockServiceRepo as any,
      mockMessageRepo as any,
      mockAvailabilityFetcher as any,
      mockPool as any,
      mockFaqRepo as any
    );

    return { builder, mockCustomerRepo, mockShopRepo, mockServiceRepo, mockMessageRepo, mockPool, mockFaqRepo };
  }

  it("returns a complete AgentContext with all 5 fields populated", async () => {
    const { builder } = makeMocks();
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });

    expect(ctx.service.serviceName).toBe("Oil Change");
    expect(ctx.customer.name).toBe("Lee Chun Nan");
    expect(ctx.shop.shopName).toBe("Peanut Auto");
    expect(ctx.conversationHistory).toEqual([]);
    expect(ctx.siblingServices).toEqual([]);
  });

  it("propagates FAQ entries from the repo onto AgentServiceContext.faqEntries", async () => {
    const faq = [
      { question: "What's included?", answer: "Hardware, setup, follow-up." },
      { question: "Cancel policy?", answer: "At least 4 hours notice." },
    ];
    const { builder, mockFaqRepo } = makeMocks({ faqEntries: faq });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(mockFaqRepo.getEntriesForService).toHaveBeenCalledWith("srv_main");
    expect(ctx.service.faqEntries).toEqual(faq);
  });

  it("returns an empty faqEntries array when the service has no entries", async () => {
    const { builder } = makeMocks({ faqEntries: [] });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.service.faqEntries).toEqual([]);
  });

  it("propagates shop contact details (address/phone/email/website) when set on the row", async () => {
    const { builder } = makeMocks({
      shop: {
        shopId: "peanut",
        name: "Peanut Auto",
        category: "automotive",
        timezone: "America/Chicago",
        address: "Obong-Patacbo Barangay Road, Pangasinan, Philippines",
        phone: "09162512445",
        email: "kyle@example.com",
        website: "https://peanut.example",
      },
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.shop.address).toBe("Obong-Patacbo Barangay Road, Pangasinan, Philippines");
    expect(ctx.shop.phone).toBe("09162512445");
    expect(ctx.shop.email).toBe("kyle@example.com");
    expect(ctx.shop.website).toBe("https://peanut.example");
  });

  it("normalizes empty / whitespace-only contact strings to null", async () => {
    // Some legacy shop rows have empty strings instead of true nulls.
    // The prompt block should treat those as "not set" so it doesn't
    // render "Address: " with no value.
    const { builder } = makeMocks({
      shop: {
        shopId: "peanut",
        name: "Peanut Auto",
        category: "automotive",
        timezone: "America/Chicago",
        address: "",
        phone: "   ",
        email: undefined,
        website: null,
      },
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.shop.address).toBeNull();
    expect(ctx.shop.phone).toBeNull();
    expect(ctx.shop.email).toBeNull();
    expect(ctx.shop.website).toBeNull();
  });

  it("passes through service-level AI fields to AgentServiceContext", async () => {
    const { builder } = makeMocks({
      service: baseService({
        aiBookingAssistance: false,
        aiSuggestUpsells: true,
      }),
      siblingServices: [], // suggestUpsells=true but no siblings exist — still returns empty array
    });

    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });

    expect(ctx.service.bookingAssistance).toBe(false);
    expect(ctx.service.suggestUpsells).toBe(true);
  });

  it("throws when service is not found", async () => {
    const { builder } = makeMocks({ service: null });
    await expect(
      builder.build({
        customerAddress: "0xabc123",
        serviceId: "missing",
        conversationId: "conv_xxx",
      })
    ).rejects.toThrow(/Service not found/);
  });

  it("throws when customer is not found", async () => {
    const { builder } = makeMocks({ customer: null });
    await expect(
      builder.build({
        customerAddress: "0xmissing",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      })
    ).rejects.toThrow(/Customer not found/);
  });

  it("throws when shop is not found", async () => {
    const { builder } = makeMocks({ shop: null });
    await expect(
      builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      })
    ).rejects.toThrow(/Shop not found/);
  });

  it("skips siblings query when aiSuggestUpsells=false (default)", async () => {
    // Phase 1 multi-service change: getServicesByShop is now ALWAYS called
    // to populate the shop service menu (the AI's catalog of "what else does
    // this shop offer"). Sibling-specific behavior is now controlled by what
    // we DO with the result — siblings array is only populated when
    // aiSuggestUpsells=true. The DB call itself fires unconditionally.
    const { builder, mockServiceRepo } = makeMocks();
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(mockServiceRepo.getServiceById).toHaveBeenCalledTimes(1);
    // Siblings array stays empty when upsells off (the gate moved from
    // "do we query" to "do we populate the siblings array").
    expect(ctx.siblingServices).toEqual([]);
  });

  it("fetches siblings when aiSuggestUpsells=true", async () => {
    const { builder, mockServiceRepo } = makeMocks({
      service: baseService({ aiSuggestUpsells: true }),
      siblingServices: [
        { serviceId: "srv_other", serviceName: "Tire Rotation", priceUsd: 25, aiSalesEnabled: true },
      ],
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(mockServiceRepo.getServicesByShop).toHaveBeenCalledWith("peanut", expect.any(Object));
    expect(ctx.siblingServices).toHaveLength(1);
    expect(ctx.siblingServices[0].serviceName).toBe("Tire Rotation");
  });

  it("filters out the current service from sibling list", async () => {
    const { builder } = makeMocks({
      service: baseService({ aiSuggestUpsells: true }),
      siblingServices: [
        { serviceId: "srv_main", serviceName: "Oil Change", priceUsd: 89, aiSalesEnabled: true }, // same as current
        { serviceId: "srv_other", serviceName: "Tire Rotation", priceUsd: 25, aiSalesEnabled: true },
      ],
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.siblingServices).toHaveLength(1);
    expect(ctx.siblingServices[0].serviceId).toBe("srv_other");
  });

  it("filters out siblings without ai_sales_enabled", async () => {
    const { builder } = makeMocks({
      service: baseService({ aiSuggestUpsells: true }),
      siblingServices: [
        { serviceId: "srv_a", serviceName: "Service A", priceUsd: 10, aiSalesEnabled: false },
        { serviceId: "srv_b", serviceName: "Service B", priceUsd: 20, aiSalesEnabled: true },
      ],
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.siblingServices).toHaveLength(1);
    expect(ctx.siblingServices[0].serviceId).toBe("srv_b");
  });

  it("respects explicit includeUpsells=false even when service has aiSuggestUpsells=true", async () => {
    // Phase 1 multi-service change: getServicesByShop fires unconditionally
    // for the shop service menu. Explicit includeUpsells=false now only
    // suppresses the siblings array, not the underlying DB query.
    const { builder } = makeMocks({
      service: baseService({ aiSuggestUpsells: true }),
    });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
      includeUpsells: false,
    });
    // Siblings array empty (the gate that explicit includeUpsells=false controls).
    expect(ctx.siblingServices).toEqual([]);
  });

  describe("Phase 1 multi-service shop service menu", () => {
    it("populates shopServiceMenu with AI-enabled services regardless of aiSuggestUpsells", async () => {
      // Even though Newly Baker (the focused service) has aiSuggestUpsells=false,
      // the AI should still know about the shop's other AI-enabled services
      // so it can answer "what else do you offer?" honestly.
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }), // upsells OFF
        siblingServices: [
          {
            serviceId: "srv_aqua",
            serviceName: "AQua Tech",
            priceUsd: 455,
            aiSalesEnabled: true,
            description: "Laptop diagnostic and repair service.",
            durationMinutes: 60,
            category: "Tech",
          },
          {
            serviceId: "srv_mongo",
            serviceName: "Mongo Tea",
            priceUsd: 25,
            aiSalesEnabled: false, // NOT AI-enabled → filtered out
            description: "Tea tasting",
          },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      // Menu contains AQua Tech (AI-enabled) but NOT Mongo Tea (not AI-enabled).
      expect(ctx.shopServiceMenu).toHaveLength(1);
      expect(ctx.shopServiceMenu[0].serviceName).toBe("AQua Tech");
      expect(ctx.shopServiceMenu[0].priceUsd).toBe(455);
      expect(ctx.shopServiceMenu[0].durationMinutes).toBe(60);
      expect(ctx.shopServiceMenu[0].shortBlurb).toBe("Laptop diagnostic and repair service.");
      // Siblings array stays empty since aiSuggestUpsells=false.
      expect(ctx.siblingServices).toEqual([]);
    });

    it("excludes the current focused service from the menu (never lists itself)", async () => {
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }),
        siblingServices: [
          {
            serviceId: "srv_main", // SAME as focused service
            serviceName: "Newly Baker",
            priceUsd: 99,
            aiSalesEnabled: true,
          },
          {
            serviceId: "srv_other",
            serviceName: "AQua Tech",
            priceUsd: 455,
            aiSalesEnabled: true,
          },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      expect(ctx.shopServiceMenu).toHaveLength(1);
      expect(ctx.shopServiceMenu[0].serviceId).toBe("srv_other");
    });

    it("renders shortBlurb as null when description is empty", async () => {
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }),
        siblingServices: [
          {
            serviceId: "srv_other",
            serviceName: "AQua Tech",
            priceUsd: 455,
            aiSalesEnabled: true,
            description: "", // empty
          },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      expect(ctx.shopServiceMenu[0].shortBlurb).toBeNull();
    });

    it("truncates long descriptions in the menu blurb", async () => {
      const longDesc = "First sentence. " + "x".repeat(200);
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }),
        siblingServices: [
          {
            serviceId: "srv_other",
            serviceName: "AQua Tech",
            priceUsd: 455,
            aiSalesEnabled: true,
            description: longDesc,
          },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      // First sentence wins (under 120 chars)
      expect(ctx.shopServiceMenu[0].shortBlurb).toBe("First sentence.");
    });

    it("propagates aiBookingAssistance onto each menu item (Phase 2 follow-up)", async () => {
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }),
        siblingServices: [
          {
            serviceId: "srv_book_yes",
            serviceName: "Pastry Tutorial",
            priceUsd: 99,
            aiSalesEnabled: true,
            aiBookingAssistance: true,
          },
          {
            serviceId: "srv_book_no",
            serviceName: "Laptop Repair",
            priceUsd: 455,
            aiSalesEnabled: true,
            aiBookingAssistance: false,
          },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      const byId = Object.fromEntries(ctx.shopServiceMenu.map((m) => [m.serviceId, m]));
      expect(byId["srv_book_yes"].bookingAssistance).toBe(true);
      expect(byId["srv_book_no"].bookingAssistance).toBe(false);
    });

    it("passes only bookable services to the multi-service slot fetcher (Phase 2 follow-up)", async () => {
      // Bug guard: a shop owner who toggles ai_booking_assistance OFF for a
      // service shouldn't have it booked from a sibling chat. The focused
      // service has aiBookingAssistance=true (so the booking path fires);
      // one menu item has aiBookingAssistance=true and one has it false.
      // Only the bookable ones (focused + the one menu item) should land in
      // fetchUpcomingSlotsForServices.
      const mockCustomerRepo = { getCustomer: jest.fn().mockResolvedValue(baseCustomer()) };
      const mockShopRepo = { getShop: jest.fn().mockResolvedValue(baseShop()) };
      const mockServiceRepo = {
        getServiceById: jest.fn().mockResolvedValue(baseService({ aiBookingAssistance: true })),
        getServicesByShop: jest.fn().mockResolvedValue({
          items: [
            {
              serviceId: "srv_book_yes",
              serviceName: "Pastry Tutorial",
              priceUsd: 99,
              aiSalesEnabled: true,
              aiBookingAssistance: true,
              description: "",
            },
            {
              serviceId: "srv_book_no",
              serviceName: "Laptop Repair",
              priceUsd: 455,
              aiSalesEnabled: true,
              aiBookingAssistance: false,
              description: "",
            },
          ],
          pagination: {},
        }),
      };
      const mockMessageRepo = {
        getRecentConversationMessages: jest.fn().mockResolvedValue(baseMessages()),
      };
      const mockAvailabilityFetcher = {
        fetchUpcomingSlots: jest.fn().mockResolvedValue([]),
        fetchUpcomingSlotsForServices: jest.fn().mockResolvedValue([]),
      };
      const mockPool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const mockFaqRepo = {
        getEntriesForService: jest.fn().mockResolvedValue([]),
      };

      const { ContextBuilder } = require("../../src/domains/AIAgentDomain/services/ContextBuilder");
      const builder = new ContextBuilder(
        mockCustomerRepo as any,
        mockShopRepo as any,
        mockServiceRepo as any,
        mockMessageRepo as any,
        mockAvailabilityFetcher as any,
        mockPool as any,
        mockFaqRepo as any
      );
      await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });

      expect(mockAvailabilityFetcher.fetchUpcomingSlotsForServices).toHaveBeenCalledTimes(1);
      const [, services] = mockAvailabilityFetcher.fetchUpcomingSlotsForServices.mock.calls[0];
      const ids = services.map((s: any) => s.serviceId).sort();
      // Focused service (srv_main) + bookable menu item, NOT the describe-only one.
      expect(ids).toEqual(["srv_book_yes", "srv_main"]);
      expect(ids).not.toContain("srv_book_no");
    });

    it("returns empty menu when shop has no AI-enabled services", async () => {
      const { builder } = makeMocks({
        service: baseService({ aiSuggestUpsells: false }),
        siblingServices: [
          { serviceId: "srv_a", serviceName: "A", priceUsd: 10, aiSalesEnabled: false },
          { serviceId: "srv_b", serviceName: "B", priceUsd: 20, aiSalesEnabled: false },
        ],
      });
      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      expect(ctx.shopServiceMenu).toEqual([]);
    });

    it("populates faqEntries on each menu item via the FAQ repo (per-service)", async () => {
      // sc1.png follow-up: the AI knew Newly Baker existed but had no
      // FAQ for it, only for the focused service. Fix is to fetch FAQ
      // per menu item. This test verifies the repo is called per item
      // and entries land on each menu item independently.
      const { builder, mockFaqRepo } = makeMocks({
        service: baseService(),
        siblingServices: [
          { serviceId: "srv_newly", serviceName: "Newly Baker", priceUsd: 99, aiSalesEnabled: true },
          { serviceId: "srv_aqua", serviceName: "AQua Tech", priceUsd: 455, aiSalesEnabled: true },
        ],
      });
      mockFaqRepo.getEntriesForService = jest.fn().mockImplementation((id: string) => {
        if (id === "srv_newly")
          return Promise.resolve([
            { question: "What's included?", answer: "Ingredients + take-home bake." },
          ]);
        if (id === "srv_aqua")
          return Promise.resolve([
            { question: "Brands?", answer: "Apple, Dell, HP, Lenovo." },
          ]);
        // Focused service — return whatever; not under test here.
        return Promise.resolve([]);
      });

      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      const byId = Object.fromEntries(ctx.shopServiceMenu.map((m) => [m.serviceId, m]));
      expect(byId["srv_newly"].faqEntries).toEqual([
        { question: "What's included?", answer: "Ingredients + take-home bake." },
      ]);
      expect(byId["srv_aqua"].faqEntries).toEqual([
        { question: "Brands?", answer: "Apple, Dell, HP, Lenovo." },
      ]);
      // Repo was called per menu item (plus once for the focused service).
      const callServiceIds = mockFaqRepo.getEntriesForService.mock.calls.map((c: any[]) => c[0]);
      expect(callServiceIds).toContain("srv_newly");
      expect(callServiceIds).toContain("srv_aqua");
    });

    it("returns empty faqEntries on a menu item when its FAQ fetch fails (graceful)", async () => {
      // Per-service failures shouldn't break the menu — that service
      // just renders without its FAQ block. Same fault-tolerance the
      // rest of fetchShopServiceMenu already has.
      const { builder, mockFaqRepo } = makeMocks({
        service: baseService(),
        siblingServices: [
          { serviceId: "srv_newly", serviceName: "Newly Baker", priceUsd: 99, aiSalesEnabled: true },
          { serviceId: "srv_aqua", serviceName: "AQua Tech", priceUsd: 455, aiSalesEnabled: true },
        ],
      });
      mockFaqRepo.getEntriesForService = jest.fn().mockImplementation((id: string) => {
        if (id === "srv_newly") return Promise.reject(new Error("transient DB blip"));
        if (id === "srv_aqua") return Promise.resolve([{ question: "Q", answer: "A" }]);
        return Promise.resolve([]);
      });

      const ctx = await builder.build({
        customerAddress: "0xabc123",
        serviceId: "srv_main",
        conversationId: "conv_xxx",
      });
      const byId = Object.fromEntries(ctx.shopServiceMenu.map((m) => [m.serviceId, m]));
      // The failed-fetch item lands with an empty FAQ instead of throwing.
      expect(byId["srv_newly"].faqEntries).toEqual([]);
      // The healthy partner still gets its FAQ.
      expect(byId["srv_aqua"].faqEntries).toEqual([{ question: "Q", answer: "A" }]);
    });
  });

  it("maps customer messages → 'user' role and shop messages → 'assistant' role", async () => {
    const { builder } = makeMocks({ messageCount: 4 });
    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(ctx.conversationHistory).toHaveLength(4);
    expect(ctx.conversationHistory[0].role).toBe("user");      // customer (i=0)
    expect(ctx.conversationHistory[1].role).toBe("assistant"); // shop (i=1)
    expect(ctx.conversationHistory[2].role).toBe("user");
    expect(ctx.conversationHistory[3].role).toBe("assistant");
  });

  it("requests the recent 20-message window oldest-first from the message repo", async () => {
    const { builder, mockMessageRepo } = makeMocks();
    await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    // Must use getRecentConversationMessages (newest N, re-sorted ASC) —
    // NOT getConversationMessages(sort:'asc'), which returns the OLDEST N
    // and freezes the AI's context once a thread passes 20 messages.
    expect(mockMessageRepo.getRecentConversationMessages).toHaveBeenCalledWith(
      "conv_xxx",
      20
    );
  });

  it("reads messageText (canonical Message shape) when content field absent", async () => {
    // Real MessageRepository.Message rows expose `messageText`, not `content`.
    // Earlier toMessageContext was reading row.content and silently dropping
    // every body to "", which made Anthropic reject the conversation with
    // "user messages must have non-empty content". Regression guard.
    const messages = [
      { messageText: "first user msg", senderType: "customer", createdAt: new Date() },
      { messageText: "shop reply",     senderType: "shop",     createdAt: new Date() },
    ];
    const mockCustomerRepo = { getCustomer: jest.fn().mockResolvedValue(baseCustomer()) };
    const mockShopRepo = { getShop: jest.fn().mockResolvedValue(baseShop()) };
    const mockServiceRepo = {
      getServiceById: jest.fn().mockResolvedValue(baseService()),
      getServicesByShop: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    };
    const mockMessageRepo = {
      getRecentConversationMessages: jest.fn().mockResolvedValue(messages),
    };
    const mockFaqRepo = {
      getEntriesForService: jest.fn().mockResolvedValue([]),
    };
    const mockAvailabilityFetcher = {
      fetchUpcomingSlots: jest.fn().mockResolvedValue([]),
      fetchUpcomingSlotsForServices: jest.fn().mockResolvedValue([]),
    };
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const builder = new ContextBuilder(
      mockCustomerRepo as any,
      mockShopRepo as any,
      mockServiceRepo as any,
      mockMessageRepo as any,
      mockAvailabilityFetcher as any,
      mockPool as any,
      mockFaqRepo as any
    );

    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });

    expect(ctx.conversationHistory).toHaveLength(2);
    expect(ctx.conversationHistory[0].content).toBe("first user msg");
    expect(ctx.conversationHistory[1].content).toBe("shop reply");
  });

  it("reads message_text (raw pg row shape) as a second fallback", async () => {
    const messages = [
      { message_text: "raw row body", sender_type: "customer", created_at: new Date() },
    ];
    const mockCustomerRepo = { getCustomer: jest.fn().mockResolvedValue(baseCustomer()) };
    const mockShopRepo = { getShop: jest.fn().mockResolvedValue(baseShop()) };
    const mockServiceRepo = {
      getServiceById: jest.fn().mockResolvedValue(baseService()),
      getServicesByShop: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    };
    const mockMessageRepo = {
      getRecentConversationMessages: jest.fn().mockResolvedValue(messages),
    };
    const mockFaqRepo = {
      getEntriesForService: jest.fn().mockResolvedValue([]),
    };
    const mockAvailabilityFetcher = {
      fetchUpcomingSlots: jest.fn().mockResolvedValue([]),
      fetchUpcomingSlotsForServices: jest.fn().mockResolvedValue([]),
    };
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const builder = new ContextBuilder(
      mockCustomerRepo as any,
      mockShopRepo as any,
      mockServiceRepo as any,
      mockMessageRepo as any,
      mockAvailabilityFetcher as any,
      mockPool as any,
      mockFaqRepo as any
    );

    const ctx = await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });

    expect(ctx.conversationHistory[0].content).toBe("raw row body");
    expect(ctx.conversationHistory[0].role).toBe("user");
  });
});

describe("ContextBuilder — shop hours summarizer (Phase 3 follow-up)", () => {
  // makeMocks is declared in the outer describe block above; redefine the
  // helper signature here for type clarity within this block.
  function makeMocks(opts: any = {}) {
    const baseService = () => ({
      serviceId: "srv_main",
      shopId: "peanut",
      serviceName: "Newly Baker",
      description: "test",
      priceUsd: 99,
      durationMinutes: 30,
      category: "food",
      aiSalesEnabled: true,
      aiTone: "friendly",
      aiSuggestUpsells: false,
      aiBookingAssistance: false,
      aiCustomInstructions: null,
      active: true,
    });
    const baseShop = () => ({ shopId: "peanut", name: "Peanut", category: "food", timezone: "America/New_York" });
    const baseCustomer = () => ({ address: "0xabc", name: "Qua", tier: "BRONZE", currentBalance: 0, joinDate: null });

    const mockCustomerRepo = { getCustomer: jest.fn().mockResolvedValue(baseCustomer()) };
    const mockShopRepo = { getShop: jest.fn().mockResolvedValue(baseShop()) };
    const mockServiceRepo = {
      getServiceById: jest.fn().mockResolvedValue(baseService()),
      getServicesByShop: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    };
    const mockMessageRepo = {
      getRecentConversationMessages: jest.fn().mockResolvedValue([]),
    };
    const mockAvailabilityFetcher = {
      fetchUpcomingSlots: jest.fn().mockResolvedValue([]),
      fetchUpcomingSlotsForServices: jest.fn().mockResolvedValue([]),
    };
    const mockPool = { query: jest.fn().mockResolvedValue({ rows: opts.weeklyHoursRows ?? [] }) };
    const mockFaqRepo = {
      getEntriesForService: jest.fn().mockResolvedValue([]),
    };

    const builder = new ContextBuilder(
      mockCustomerRepo as any,
      mockShopRepo as any,
      mockServiceRepo as any,
      mockMessageRepo as any,
      mockAvailabilityFetcher as any,
      mockPool as any,
      mockFaqRepo as any
    );
    return { builder, mockPool };
  }

  const buildCtx = (builder: any) =>
    builder.build({
      customerAddress: "0xabc",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });

  it("returns null when shop_availability has no rows", async () => {
    const { builder } = makeMocks({ weeklyHoursRows: [] });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toBeNull();
  });

  it("formats a typical weekday-uniform schedule", async () => {
    // Mon-Fri 9am-5pm, Sat-Sun closed
    const rows = [
      { day_of_week: 0, is_open: false, open_time: null, close_time: null },
      { day_of_week: 1, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 3, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 4, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 5, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ];
    const { builder } = makeMocks({ weeklyHoursRows: rows });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toBe("Sun closed, Mon-Fri 9am-5pm, Sat closed");
  });

  it("compresses adjacent same-hours days into ranges", async () => {
    // Sun-Thu 9am-6pm, Fri 9am-5pm, Sat closed (matches the actual peanut shop on staging)
    const rows = [
      { day_of_week: 0, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
      { day_of_week: 1, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
      { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
      { day_of_week: 3, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
      { day_of_week: 4, is_open: true, open_time: "09:00:00", close_time: "18:00:00" },
      { day_of_week: 5, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ];
    const { builder } = makeMocks({ weeklyHoursRows: rows });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toBe("Sun-Thu 9am-6pm, Fri 9am-5pm, Sat closed");
  });

  it("handles half-hour close times (5:30pm)", async () => {
    const rows = [
      { day_of_week: 1, is_open: true, open_time: "10:00:00", close_time: "17:30:00" },
    ];
    const { builder } = makeMocks({ weeklyHoursRows: rows });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toContain("10am-5:30pm");
  });

  it("returns null when literally every day is closed", async () => {
    const rows = [
      { day_of_week: 0, is_open: false, open_time: null, close_time: null },
      { day_of_week: 1, is_open: false, open_time: null, close_time: null },
    ];
    const { builder } = makeMocks({ weeklyHoursRows: rows });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toBeNull();
  });

  it("ignores rows with day_of_week outside 0-6 (defensive for legacy bad data)", async () => {
    // Staging had rows with day_of_week=-1 and day_of_week=7 — filter them.
    const rows = [
      { day_of_week: -1, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 7, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 1, is_open: true, open_time: "09:00:00", close_time: "17:00:00" },
    ];
    const { builder } = makeMocks({ weeklyHoursRows: rows });
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toContain("Mon 9am-5pm");
    expect(ctx.shop.hoursSummary).not.toContain("-1");
    expect(ctx.shop.hoursSummary).not.toContain("day 7");
  });

  it("returns null gracefully when DB query throws (graceful degradation)", async () => {
    // makeMocks sets pool.query to a stub that resolves; override here to
    // simulate the real DB failing. fetchWeeklyHours catches and returns [].
    const { builder, mockPool } = makeMocks();
    mockPool.query.mockRejectedValueOnce(new Error("connection refused"));
    const ctx = await buildCtx(builder);
    expect(ctx.shop.hoursSummary).toBeNull();
  });
});
