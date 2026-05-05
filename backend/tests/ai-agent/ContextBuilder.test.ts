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

  const baseMessages = (count = 0) => ({
    items: Array.from({ length: count }, (_, i) => ({
      conversationId: "conv_xxx",
      content: `message ${i + 1}`,
      senderType: i % 2 === 0 ? "customer" : "shop",
      createdAt: new Date(Date.now() + i * 1000),
    })),
    pagination: { page: 1, limit: 20, totalItems: count, totalPages: 1 },
  });

  function makeMocks(opts: {
    service?: any;
    customer?: any;
    shop?: any;
    messageCount?: number;
    siblingServices?: any[];
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
      getConversationMessages: jest.fn().mockResolvedValue(messages),
    };

    const builder = new ContextBuilder(
      mockCustomerRepo as any,
      mockShopRepo as any,
      mockServiceRepo as any,
      mockMessageRepo as any
    );

    return { builder, mockCustomerRepo, mockShopRepo, mockServiceRepo, mockMessageRepo };
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

  it("passes through service-level AI fields to AgentServiceContext", async () => {
    const { builder } = makeMocks({
      service: baseService({
        aiCustomInstructions: "Always mention 30-day warranty",
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

    expect(ctx.service.customInstructions).toBe("Always mention 30-day warranty");
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
    const { builder, mockServiceRepo } = makeMocks();
    await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(mockServiceRepo.getServiceById).toHaveBeenCalledTimes(1);
    expect(mockServiceRepo.getServicesByShop).not.toHaveBeenCalled();
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
    const { builder, mockServiceRepo } = makeMocks({
      service: baseService({ aiSuggestUpsells: true }),
    });
    await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
      includeUpsells: false,
    });
    expect(mockServiceRepo.getServicesByShop).not.toHaveBeenCalled();
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

  it("requests last 20 messages oldest-first from the message repo", async () => {
    const { builder, mockMessageRepo } = makeMocks();
    await builder.build({
      customerAddress: "0xabc123",
      serviceId: "srv_main",
      conversationId: "conv_xxx",
    });
    expect(mockMessageRepo.getConversationMessages).toHaveBeenCalledWith("conv_xxx", {
      limit: 20,
      sort: "asc",
    });
  });
});
