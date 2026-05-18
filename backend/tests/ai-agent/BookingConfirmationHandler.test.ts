// backend/tests/ai-agent/BookingConfirmationHandler.test.ts
//
// Verify the booking-confirmation hook posts a "your appointment is
// confirmed" message into the chat (and skips) under the right conditions.
// Subscribed to `service.order_paid`; the message is templated (no Claude).

import { BookingConfirmationHandler } from "../../src/domains/AIAgentDomain/services/BookingConfirmationHandler";

// ----- Helpers -----

const samplePayload = (overrides: any = {}) => ({
  orderId: "ord_xxx",
  customerAddress: "0xabc",
  shopId: "shop_test",
  serviceId: "srv_xxx",
  conversationId: "conv_xxx",
  bookingDate: new Date("2026-05-08"),
  bookingTime: "14:30",
  totalAmount: 99,
  ...overrides,
});

const sampleEvent = (payload: any = samplePayload()) => ({
  type: "service.order_paid",
  aggregateId: payload.customerAddress,
  data: payload,
  timestamp: new Date(),
  source: "ServiceDomain",
  version: 1,
});

interface MockOpts {
  order?: any;
  conversationExists?: boolean;
  alreadySent?: boolean;
  shop?: any;
  customer?: any;
}

const makeMocks = (opts: MockOpts = {}) => {
  const conversationExists = opts.conversationExists ?? true;
  const alreadySent = opts.alreadySent ?? false;

  // pool.query handles two EXISTS queries — distinguished by table:
  //   1. SELECT EXISTS (... FROM conversations ...) — conversation row check
  //   2. SELECT EXISTS (... FROM messages ...)      — idempotency check
  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM conversations")) {
        return Promise.resolve({ rows: [{ exists: conversationExists }] });
      }
      if (sql.includes("FROM messages")) {
        return Promise.resolve({ rows: [{ exists: alreadySent }] });
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

  // Sentinel `in` check so an explicit `order: null` resolves to null
  // rather than coalescing through to the default.
  const orderResolved =
    "order" in opts
      ? opts.order
      : {
          orderId: "ord_xxx",
          customerAddress: "0xabc",
          shopId: "shop_test",
          serviceId: "srv_xxx",
          conversationId: "conv_xxx",
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
      .mockResolvedValue(opts.customer ?? { name: "Qua Ting" }),
  };

  const handler = new BookingConfirmationHandler({
    pool: pool as any,
    messageRepo: messageRepo as any,
    orderRepo: orderRepo as any,
    shopRepo: shopRepo as any,
    customerRepo: customerRepo as any,
  });

  return { handler, pool, messageRepo, orderRepo, shopRepo, customerRepo };
};

// ----- Tests -----

describe("BookingConfirmationHandler — fires when conditions met", () => {
  it("posts a confirmation message when the order has a conversation_id", async () => {
    const { handler, messageRepo } = makeMocks();

    await handler.handleOrderPaid(sampleEvent());

    expect(messageRepo.createMessage).toHaveBeenCalledTimes(1);
    const arg = messageRepo.createMessage.mock.calls[0][0];
    expect(arg.conversationId).toBe("conv_xxx");
    expect(arg.senderType).toBe("shop");
    expect(arg.senderAddress).toBe("shop_test");
    expect(arg.metadata.generated_by).toBe("ai_agent");
    expect(arg.metadata.source).toBe("booking_confirmed");
    expect(arg.metadata.order_id).toBe("ord_xxx");
  });

  it("includes the customer name, shop name, and slot label in the message", async () => {
    const { handler, messageRepo } = makeMocks({
      customer: { name: "Qua Ting" },
      shop: { name: "Peanut" },
    });
    await handler.handleOrderPaid(sampleEvent());
    const text = messageRepo.createMessage.mock.calls[0][0].messageText;
    expect(text).toContain("Qua Ting");
    expect(text).toContain("Peanut");
    // 14:30 on 2026-05-08 (a Friday) → "Friday, May 8 at 2:30 PM"
    expect(text).toContain("Friday, May 8 at 2:30 PM");
  });

  it("falls back to a generic confirmation when the slot is missing", async () => {
    const { handler, messageRepo } = makeMocks({
      order: {
        orderId: "ord_xxx",
        customerAddress: "0xabc",
        shopId: "shop_test",
        serviceId: "srv_xxx",
        conversationId: "conv_xxx",
        bookingDate: null,
        bookingTime: null,
      },
    });
    await handler.handleOrderPaid(sampleEvent());
    const text = messageRepo.createMessage.mock.calls[0][0].messageText;
    expect(text).toContain("confirmed");
    expect(text).not.toContain("undefined");
  });
});

describe("BookingConfirmationHandler — skip paths", () => {
  it("skips when the order has no conversation_id (marketplace booking)", async () => {
    const { handler, messageRepo } = makeMocks({
      order: {
        orderId: "ord_xxx",
        customerAddress: "0xabc",
        shopId: "shop_test",
        serviceId: "srv_xxx",
        conversationId: undefined,
        bookingDate: new Date("2026-05-08"),
        bookingTime: "14:30",
      },
    });
    await handler.handleOrderPaid(sampleEvent({ conversationId: null }));
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when the conversation row no longer exists", async () => {
    const { handler, messageRepo } = makeMocks({ conversationExists: false });
    await handler.handleOrderPaid(sampleEvent());
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("is idempotent — skips when a confirmation for this order already exists", async () => {
    const { handler, messageRepo } = makeMocks({ alreadySent: true });
    await handler.handleOrderPaid(sampleEvent());
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips when the order is not found in the DB", async () => {
    const { handler, messageRepo } = makeMocks({ order: null });
    await handler.handleOrderPaid(sampleEvent());
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("skips silently on a malformed event payload (does not throw)", async () => {
    const { handler, messageRepo } = makeMocks();
    await expect(
      handler.handleOrderPaid({
        type: "service.order_paid",
        aggregateId: "x",
        data: { somethingElse: true } as any,
        timestamp: new Date(),
        source: "ServiceDomain",
        version: 1,
      })
    ).resolves.toBeUndefined();
    expect(messageRepo.createMessage).not.toHaveBeenCalled();
  });
});

describe("BookingConfirmationHandler — failure handling never breaks booking flow", () => {
  it("swallows errors thrown by repos so the payment flow continues", async () => {
    const orderRepo = {
      getOrderById: jest.fn().mockRejectedValue(new Error("DB outage")),
    };
    const base = makeMocks();
    const handler = new BookingConfirmationHandler({
      pool: base.pool as any,
      messageRepo: base.messageRepo as any,
      orderRepo: orderRepo as any,
      shopRepo: base.shopRepo as any,
      customerRepo: base.customerRepo as any,
    });
    await expect(handler.handleOrderPaid(sampleEvent())).resolves.toBeUndefined();
    expect(base.messageRepo.createMessage).not.toHaveBeenCalled();
  });

  it("swallows a createMessage failure", async () => {
    const { handler, messageRepo } = makeMocks();
    messageRepo.createMessage.mockRejectedValueOnce(new Error("insert failed"));
    await expect(handler.handleOrderPaid(sampleEvent())).resolves.toBeUndefined();
  });
});

describe("BookingConfirmationHandler — WebSocket broadcast on success", () => {
  it("broadcasts message:new to the customer when a WS manager is set", async () => {
    const { handler } = makeMocks();
    const ws = { sendToAddresses: jest.fn() };
    handler.setWebSocketManager(ws as any);
    await handler.handleOrderPaid(sampleEvent());
    expect(ws.sendToAddresses).toHaveBeenCalledWith(
      ["0xabc"],
      expect.objectContaining({
        type: "message:new",
        payload: { conversationId: "conv_xxx" },
      })
    );
  });

  it("also broadcasts to the shop's walletAddress when present", async () => {
    const { handler } = makeMocks({
      shop: { name: "Peanut", walletAddress: "0xSHOP123" } as any,
    });
    const ws = { sendToAddresses: jest.fn() };
    handler.setWebSocketManager(ws as any);
    await handler.handleOrderPaid(sampleEvent());
    expect(ws.sendToAddresses).toHaveBeenCalledTimes(1);
    const targets = (ws.sendToAddresses as jest.Mock).mock.calls[0][0];
    expect(new Set(targets)).toEqual(new Set(["0xabc", "0xshop123"]));
  });

  it("does not crash when no WS manager is set", async () => {
    const { handler } = makeMocks();
    await expect(handler.handleOrderPaid(sampleEvent())).resolves.toBeUndefined();
  });
});
