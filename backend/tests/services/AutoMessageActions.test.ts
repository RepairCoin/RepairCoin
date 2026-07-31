// Custom Workflows W1 — "actions as data" (docs/tasks/strategy/custom-workflows/scope.md §7).
//
// The automation engine used to end both of its execution paths in a hardcoded createMessage(), so
// "send a message" was the only automation a shop could ever build. These tests cover the dispatch
// that replaced it: send_message must behave exactly as the inline code did, and adding a NEW action
// must require nothing but registering a handler — that last one is the whole point of W1.

import {
  AutoMessageActionRegistry,
  DEFAULT_ACTION_TYPE,
} from "../../src/services/autoMessageActions/registry";
import { SendMessageAction } from "../../src/services/autoMessageActions/sendMessageAction";
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
} from "../../src/services/autoMessageActions/types";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-1",
  shopId: "peanut",
  name: "Thanks after booking",
  messageTemplate: "Thanks {{customerName}}!",
  triggerType: "event",
  scheduleType: null,
  scheduleDayOfWeek: null,
  scheduleDayOfMonth: null,
  scheduleHour: 10,
  eventType: "booking_completed",
  delayHours: 0,
  targetAudience: "all",
  isActive: true,
  maxSendsPerCustomer: 1,
  steps: null,
  stopOnBooking: false,
  variantB: null,
  actionType: "send_message",
  actionPayload: null,
  createdAt: "2026-07-28T00:00:00Z",
  updatedAt: "2026-07-28T00:00:00Z",
  ...over,
});

const ctx = (over: Partial<AutoMessageActionContext> = {}): AutoMessageActionContext => ({
  rule: rule(),
  shopId: "peanut",
  customerAddress: "0xabc",
  customerName: "Mike",
  shopName: "Peanut Repairs",
  messageText: "Thanks Mike!",
  ...over,
});

const makeMessages = (over: { isBlocked?: boolean } = {}) => {
  const created: any[] = [];
  const unread: any[] = [];
  return {
    created,
    unread,
    getOrCreateConversation: jest.fn(async () => ({ conversationId: "conv-1", isBlocked: over.isBlocked })),
    createMessage: jest.fn(async (input: any) => {
      created.push(input);
      return { message: { messageId: input.messageId } };
    }),
    incrementUnreadCount: jest.fn(async (...a: any[]) => { unread.push(a); return null; }),
  };
};

describe("SendMessageAction — the historical behaviour, now a handler", () => {
  it("creates the message, bumps unread, and returns the ids the caller records", async () => {
    const messages = makeMessages();
    const out = await new SendMessageAction(messages as any).execute(ctx());

    expect(out.ok).toBe(true);
    expect(out.conversationId).toBe("conv-1");
    expect(out.messageId).toEqual(expect.stringMatching(/^msg_/));
    expect(messages.created).toHaveLength(1);
    expect(messages.created[0]).toMatchObject({
      conversationId: "conv-1",
      senderAddress: "peanut",
      senderType: "shop",
      messageText: "Thanks Mike!",
      messageType: "text",
      metadata: { autoMessageId: "rule-1", autoMessageName: "Thanks after booking", isAutoMessage: true },
    });
    expect(messages.unread).toEqual([["conv-1", "customer", "Thanks Mike!"]]);
  });

  it("treats a blocked conversation as a silent skip, not a failure — and sends nothing", async () => {
    const messages = makeMessages({ isBlocked: true });
    const out = await new SendMessageAction(messages as any).execute(ctx());

    expect(out).toMatchObject({ ok: false, skipped: "blocked" });
    expect(messages.createMessage).not.toHaveBeenCalled();
    expect(messages.incrementUnreadCount).not.toHaveBeenCalled();
  });

  it("refuses to post an empty body (a drip step whose template was emptied)", async () => {
    const messages = makeMessages();
    const out = await new SendMessageAction(messages as any).execute(ctx({ messageText: "   " }));

    expect(out).toMatchObject({ ok: false, skipped: "empty" });
    expect(messages.getOrCreateConversation).not.toHaveBeenCalled();
    expect(messages.createMessage).not.toHaveBeenCalled();
  });
});

describe("AutoMessageActionRegistry — dispatch", () => {
  it("routes a send_message rule to the send_message handler", async () => {
    const messages = makeMessages();
    const reg = new AutoMessageActionRegistry([new SendMessageAction(messages as any)]);
    const out = await reg.run(ctx());
    expect(out.ok).toBe(true);
    expect(messages.created).toHaveLength(1);
  });

  it("treats a rule with no action_type as send_message (rows written before migration 247)", async () => {
    const messages = makeMessages();
    const reg = new AutoMessageActionRegistry([new SendMessageAction(messages as any)]);
    const out = await reg.run(ctx({ rule: rule({ actionType: undefined as any }) }));
    expect(out.ok).toBe(true);
    expect(messages.created).toHaveLength(1);
    expect(DEFAULT_ACTION_TYPE).toBe("send_message");
  });

  // The scheduler processes every shop's rules in one tick — a single unrecognised action_type must
  // not take the whole run down with it.
  it("never throws on an unknown action type — it skips the rule and reports why", async () => {
    const reg = new AutoMessageActionRegistry([new SendMessageAction(makeMessages() as any)]);
    await expect(reg.run(ctx({ rule: rule({ actionType: "teleport_customer" }) }))).resolves.toMatchObject({
      ok: false,
      skipped: "unknown_action",
    });
  });

  // W1 exists so that W2's actions (issue_reward, notify_staff, flag_reorder, run_campaign, ai_step)
  // cost a handler each instead of a schema change plus surgery on an 848-line scheduler. If this
  // test ever needs more than a register() call, W1 failed at its job.
  it("supports a brand-new action with nothing but a register() call", async () => {
    const ran: string[] = [];
    const issueReward: AutoMessageActionHandler = {
      type: "issue_reward",
      execute: async (c) => { ran.push(c.customerAddress); return { ok: true }; },
    };

    const reg = new AutoMessageActionRegistry([new SendMessageAction(makeMessages() as any)]);
    expect(reg.has("issue_reward")).toBe(false);
    reg.register(issueReward);

    const out = await reg.run(ctx({ rule: rule({ actionType: "issue_reward" }) }));
    expect(out.ok).toBe(true);
    expect(ran).toEqual(["0xabc"]);
  });
});
