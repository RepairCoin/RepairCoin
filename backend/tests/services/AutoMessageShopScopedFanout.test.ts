// A shop-scoped action must fire ONCE per run — never once per customer in the target audience.
//
// The bug this pins: processScheduledMessages resolves a target audience and then runs the rule's
// action for each person. That is right for a message or a reward, and an alert storm for
// `notify_staff` — "every Monday, remind the team" over an audience of 200 paged the team 50 times (the
// per-run cap), silently turning Target Audience into a multiplier. The same shape existed in both
// sweep paths (processInactiveCustomers, processLowBookings).
//
// These tests deliberately assert in BOTH directions. A guard that made every rule fire once would
// break messaging entirely while making the storm tests pass, so `send_message` and `issue_reward` are
// pinned as still fanning out. `issue_reward` is the interesting one: it sends no message, so it lives
// in NON_MESSAGING_ACTIONS — but it still needs somebody to pay, which is why the fix keys on the
// narrower SHOP_SCOPED_ACTIONS instead.

const mockRun = jest.fn(async () => ({ ok: true }));

jest.mock("../../src/services/autoMessageActions/registry", () => {
  const actual = jest.requireActual("../../src/services/autoMessageActions/registry");
  return { ...actual, getAutoMessageActionRegistry: () => ({ run: mockRun }) };
});

// The two sweeps query the pool directly rather than going through a repository, so the pool itself has
// to be faked or the test hits the live DigitalOcean database. `mockRows` is what the next query returns.
let mockRows: any[] = [];
jest.mock("../../src/utils/database-pool", () => ({
  getSharedPool: () => ({ query: jest.fn(async () => ({ rows: mockRows })) }),
}));

import { AutoMessageSchedulerService } from "../../src/services/AutoMessageSchedulerService";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-s1",
  shopId: "peanut",
  name: "Monday team reminder",
  messageTemplate: "hello",
  triggerType: "schedule",
  scheduleType: "weekly",
  scheduleDayOfWeek: 1,
  scheduleDayOfMonth: null,
  scheduleHour: 10,
  eventType: null,
  delayHours: 0,
  targetAudience: "all",
  isActive: true,
  maxSendsPerCustomer: 0,
  steps: null,
  stopOnBooking: false,
  variantB: null,
  actionType: "notify_staff",
  actionPayload: { message: "Check the queue." },
  surface: "workflow",
  createdAt: "2026-07-30T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
  ...over,
});

const AUDIENCE = [
  { walletAddress: "0xc1", name: "One" },
  { walletAddress: "0xc2", name: "Two" },
  { walletAddress: "0xc3", name: "Three" },
];

/**
 * A scheduler wired to fakes. Repos are replaced on the instance (the constructor builds its own and
 * takes no injection), and the private helpers that would otherwise reach the database are stubbed:
 * `isDue` so the test doesn't depend on the wall clock, and `isShopEntitled` because it calls
 * getShopTier module-internally — a jest.spyOn there never intercepts, which is how an earlier test
 * file silently ran against the live database.
 */
const scheduler = (opts: {
  rules?: AutoMessage[];
  sweepRules?: AutoMessage[];
  alreadySentToday?: boolean;
  entitled?: boolean;
}) => {
  const recorded: any[] = [];
  const svc: any = new AutoMessageSchedulerService();

  svc.autoMessageRepo = {
    getActiveScheduleRules: jest.fn(async () => opts.rules ?? []),
    hasSentTodayShopScoped: jest.fn(async () => opts.alreadySentToday ?? false),
    // The rule-level daily gate that makes catch-up safe (see isDue / CATCH_UP_HOURS).
    hasAnySendToday: jest.fn(async () => opts.alreadySentToday ?? false),
    hasSentToday: jest.fn(async () => false),
    countSendsForCustomer: jest.fn(async () => 0),
    recordSend: jest.fn(async (s: any) => { recorded.push(s); return { id: "send-1" }; }),
    getPendingSends: jest.fn(async () => []),
    hasSentWithinDays: jest.fn(async () => false),
    // processScheduledMessages also drives the two sweeps; default them to "no rules".
    getAllActiveEventRulesByType: jest.fn(async () => opts.sweepRules ?? []),
  };
  svc.shopRepo = { getShop: jest.fn(async () => ({ id: "peanut", name: "Peanut Repairs", active: true })) };
  // `isDue` (was shouldRunNow) is stubbed so these tests don't depend on the wall clock.
  svc.isDue = () => true;
  svc.isShopEntitled = async () => opts.entitled ?? true;
  svc.getTargetCustomers = async () => AUDIENCE;

  return { svc, recorded };
};

beforeEach(() => {
  mockRun.mockClear();
  mockRows = [];
});

describe("scheduled rules — shop-scoped actions fire once, customer actions fan out", () => {
  it("runs notify_staff ONCE even though the audience holds 3 customers", async () => {
    const { svc } = scheduler({ rules: [rule()] });
    await svc.processScheduledMessages();
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("runs the action with no customer in context", async () => {
    const { svc } = scheduler({ rules: [rule()] });
    await svc.processScheduledMessages();
    const ctx = mockRun.mock.calls[0][0] as any;
    expect(ctx.customerAddress).toBe("");
    expect(ctx.actionType).toBe("notify_staff");
  });

  it("records the run against a NULL customer, so 'Last run' works without inventing one", async () => {
    const { svc, recorded } = scheduler({ rules: [rule()] });
    await svc.processScheduledMessages();
    expect(recorded).toEqual([
      expect.objectContaining({ autoMessageId: "rule-s1", customerAddress: null, status: "sent" }),
    ]);
  });

  // The counterweight: a guard that fired everything once would pass the tests above and break
  // messaging outright.
  it("still fans send_message out to every customer in the audience", async () => {
    const { svc } = scheduler({ rules: [rule({ actionType: "send_message" })] });
    await svc.processScheduledMessages();
    expect(mockRun).toHaveBeenCalledTimes(AUDIENCE.length);
  });

  // issue_reward is in NON_MESSAGING_ACTIONS but still needs a recipient — hence SHOP_SCOPED_ACTIONS.
  it("still fans issue_reward out per customer — no message, but somebody has to be paid", async () => {
    const { svc } = scheduler({
      rules: [rule({ actionType: "issue_reward", messageTemplate: null, actionPayload: { amountRcn: 5 } })],
    });
    await svc.processScheduledMessages();
    expect(mockRun).toHaveBeenCalledTimes(AUDIENCE.length);
  });

  // Catch-up keeps a rule due for a few hours past its slot, so "did it already run" is the only thing
  // stopping it repeating every tick. hasSentToday() can't answer it: that predicate is
  // `customer_address = $2` and shop-scoped sends store NULL, so it never matches.
  it("does not repeat the alert when it has already gone out today", async () => {
    const { svc } = scheduler({ rules: [rule()], alreadySentToday: true });
    await svc.processScheduledMessages();
    expect(mockRun).not.toHaveBeenCalled();
  });

  // The normal path gets its entitlement check inside sendToCustomer; this path skips it.
  it("does not alert a shop that is no longer entitled", async () => {
    const { svc } = scheduler({ rules: [rule()], entitled: false });
    await svc.processScheduledMessages();
    expect(mockRun).not.toHaveBeenCalled();
  });
});

// The other two paths that resolve an audience. Both are EVENT rules — they sweep on a timer rather
// than reacting to something that carries a customer — so they had the identical storm, and fixing only
// the schedule path would have left "tell my team when we have a slow week" paging per customer.
describe("sweep rules — inactive_30_days and low_bookings", () => {
  const QUIET = [
    { customer_address: "0xc1", name: "One", last_order_date: "2026-05-01" },
    { customer_address: "0xc2", name: "Two", last_order_date: "2026-05-02" },
  ];

  it("alerts once for a whole inactive-customer sweep, not once per quiet customer", async () => {
    mockRows = QUIET;
    const { svc } = scheduler({ sweepRules: [rule({ triggerType: "event", eventType: "inactive_30_days" })] });
    await svc.processInactiveCustomers();
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  // The count is the whole point of the alert — the owner already knows customers go quiet.
  it("names the count in the alert", async () => {
    mockRows = QUIET;
    const { svc } = scheduler({ sweepRules: [rule({ triggerType: "event", eventType: "inactive_30_days" })] });
    await svc.processInactiveCustomers();
    expect((mockRun.mock.calls[0][0] as any).triggerDetail).toContain("2 customers");
  });

  it("still messages every quiet customer when the action is send_message", async () => {
    mockRows = QUIET;
    const { svc } = scheduler({
      sweepRules: [rule({ triggerType: "event", eventType: "inactive_30_days", actionType: "send_message" })],
    });
    await svc.processInactiveCustomers();
    expect(mockRun).toHaveBeenCalledTimes(QUIET.length);
  });

  it("alerts once for a slow week, with the booking numbers", async () => {
    // Shaped for the slow-week test: 1 booking in the last 7 days against a 12/28-day baseline.
    mockRows = [{ last7: 1, prior28: 12 }];
    const { svc } = scheduler({ sweepRules: [rule({ triggerType: "event", eventType: "low_bookings" })] });
    await svc.processLowBookings();

    expect(mockRun).toHaveBeenCalledTimes(1);
    const detail = (mockRun.mock.calls[0][0] as any).triggerDetail;
    expect(detail).toContain("1 in the last 7 days");
    expect(detail).toContain("3.0/week");
  });
});
