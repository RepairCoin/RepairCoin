// One event must not message a customer twice.
//
// `handleEventTrigger` opens with a duplicate check — `hasSentForTriggerReference(rule, customer,
// orderId)` — so a repeated event about the SAME order is ignored. That check could never match. The
// immediate branch (delayHours: 0) recorded its send with no trigger reference at all, under a comment
// that claimed otherwise: "Update the send record with trigger reference", followed by nothing.
//
// So the guard read as present, cost a query per firing, and protected nothing. The delayed branch DID
// pass the reference, which is how it survived review: the feature demonstrably worked, just never on
// the path most rules use. Found 2026-08-05 while verifying `booking_created` against a real booking —
// two sends for one order, both with trigger_reference NULL.
//
// These tests assert the reference reaches the SEND ROW, not that some code path was called. What the
// row stores is the entire mechanism; a test that stubbed the repo's return value would have passed all
// along.

const mockRun = jest.fn(async () => ({ ok: true }));
jest.mock("../../src/services/autoMessageActions/registry", () => {
  const actual = jest.requireActual("../../src/services/autoMessageActions/registry");
  return { ...actual, getAutoMessageActionRegistry: () => ({ run: mockRun }) };
});
jest.mock("../../src/utils/database-pool", () => ({
  getSharedPool: () => ({ query: jest.fn(async () => ({ rows: [] })) }),
}));

import { AutoMessageSchedulerService } from "../../src/services/AutoMessageSchedulerService";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";

const ORDER = "order-abc";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-e1",
  shopId: "peanut",
  name: "Booking made",
  messageTemplate: "Hi {{customerName}}, you're booked.",
  triggerType: "event",
  eventType: "booking_created",
  scheduleType: null,
  scheduleDayOfWeek: null,
  scheduleDayOfMonth: null,
  scheduleHour: null,
  delayHours: 0,
  targetAudience: "all",
  isActive: true,
  maxSendsPerCustomer: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...(over as any),
}) as AutoMessage;

const scheduler = (opts: { rules: AutoMessage[]; seenReferences?: Set<string> }) => {
  const recorded: any[] = [];
  const seen = opts.seenReferences ?? new Set<string>();
  const svc: any = new AutoMessageSchedulerService();

  svc.autoMessageRepo = {
    getActiveEventRules: jest.fn(async () => opts.rules),
    countSendsForCustomer: jest.fn(async () => 0),
    // Backed by `seen` so the guard behaves like the database rather than a constant. With the bug,
    // nothing is ever added to `seen`, so this keeps answering false — exactly what happened live.
    hasSendForTriggerReference: jest.fn(async (_id: string, _addr: string, ref: string) => seen.has(ref)),
    recordSend: jest.fn(async (s: any) => {
      recorded.push(s);
      if (s.triggerReference) seen.add(s.triggerReference);
      return { id: `send-${recorded.length}` };
    }),
  };
  svc.shopRepo = { getShop: jest.fn(async () => ({ id: "peanut", name: "Peanut Repairs", active: true })) };
  svc.customerRepo = { getCustomer: jest.fn(async () => ({ name: "Dana" })) };
  svc.isShopEntitled = async () => true;
  // sendToCustomer's messaging internals are not what's under test; the recordSend it performs is.
  svc.sendMessageForRule = jest.fn(async () => ({ messageId: "m1", conversationId: "c1" }));

  return { svc, recorded };
};

beforeEach(() => mockRun.mockClear());

describe("event triggers record what caused the send", () => {
  it("stores the order id on an IMMEDIATE send (delayHours: 0)", async () => {
    const { svc, recorded } = scheduler({ rules: [rule()] });
    await svc.handleEventTrigger("booking_created", {
      shopId: "peanut",
      customerAddress: "0xabc",
      orderId: ORDER,
    });
    expect(recorded).toHaveLength(1);
    // The whole bug in one assertion: this was null for every immediate event rule.
    expect(recorded[0].triggerReference).toBe(ORDER);
  });

  it("stores it on a DELAYED send too — the branch that always worked", async () => {
    const { svc, recorded } = scheduler({ rules: [rule({ delayHours: 3 })] });
    await svc.handleEventTrigger("booking_created", {
      shopId: "peanut",
      customerAddress: "0xabc",
      orderId: ORDER,
    });
    expect(recorded[0].triggerReference).toBe(ORDER);
    expect(recorded[0].status).toBe("pending");
  });

  it("does not invent a reference when the event has no order", async () => {
    // Sweeps and schedules have nothing that "caused" them. Writing a placeholder would make unrelated
    // sends collide on the dedup check and silently suppress real messages.
    const { svc, recorded } = scheduler({ rules: [rule()] });
    await svc.handleEventTrigger("booking_created", { shopId: "peanut", customerAddress: "0xabc" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].triggerReference).toBeUndefined();
  });
});

describe("the same event cannot message the same customer twice", () => {
  it("ignores a repeat of the same order — a webhook retry", async () => {
    const { svc, recorded } = scheduler({ rules: [rule()] });
    const fire = () =>
      svc.handleEventTrigger("booking_created", {
        shopId: "peanut",
        customerAddress: "0xabc",
        orderId: ORDER,
      });

    await fire();
    await fire();

    // Two sends here is the live symptom, and note what does NOT save us: maxSendsPerCustomer is null
    // on this rule on purpose. An earlier version of this check passed only because a cap of 1 blocked
    // the second send, which made a broken guard look healthy.
    expect(recorded).toHaveLength(1);
  });

  it("still sends for a DIFFERENT order", async () => {
    const { svc, recorded } = scheduler({ rules: [rule()] });
    await svc.handleEventTrigger("booking_created", { shopId: "peanut", customerAddress: "0xabc", orderId: ORDER });
    await svc.handleEventTrigger("booking_created", { shopId: "peanut", customerAddress: "0xabc", orderId: "order-xyz" });
    expect(recorded).toHaveLength(2);
  });
});
