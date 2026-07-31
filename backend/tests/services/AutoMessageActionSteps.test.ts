// A1 — action steps. A sequence step may declare its OWN action, which is what turns a drip sequence
// into a workflow: "booking completed → wait 3 days → send review request → wait 2 days → issue 10 RCN".
//
// The engine already knew how to enroll a customer, wait, track step_index and enqueue the next step —
// it was simply hardcoded to message steps. These tests cover the resolution rule (step action wins
// over rule action) and, just as importantly, that a pre-A1 sequence still means exactly what it did.

import { AutoMessageActionRegistry } from "../../src/services/autoMessageActions/registry";
import { SendMessageAction } from "../../src/services/autoMessageActions/sendMessageAction";
import { IssueRewardAction } from "../../src/services/autoMessageActions/issueRewardAction";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";
import type { AutoMessageActionContext } from "../../src/services/autoMessageActions/types";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-seq",
  shopId: "peanut",
  name: "Post-repair follow-up",
  messageTemplate: "Thanks!",
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
  surface: "workflow",
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  ...over,
});

const makeMessages = () => {
  const created: any[] = [];
  return {
    created,
    getOrCreateConversation: jest.fn(async () => ({ conversationId: "conv-1", isBlocked: false })),
    createMessage: jest.fn(async (i: any) => { created.push(i); return { message: { messageId: i.messageId } }; }),
    incrementUnreadCount: jest.fn(async () => null),
  };
};
const makeIssuer = () => {
  const calls: any[] = [];
  return { calls, issueExact: jest.fn(async (a: any) => { calls.push(a); return { ok: true, txHash: "0x" }; }) };
};

const run = async (ctx: Partial<AutoMessageActionContext>, messages: any, issuer: any) =>
  new AutoMessageActionRegistry([
    new SendMessageAction(messages),
    new IssueRewardAction(issuer),
  ]).run({
    rule: rule(),
    shopId: "peanut",
    customerAddress: "0xabc",
    shopName: "Peanut Repairs",
    ...ctx,
  } as AutoMessageActionContext);

describe("A1 — a sequence step can carry its own action", () => {
  it("a reward STEP inside a messaging rule issues RCN, not a message", async () => {
    const messages = makeMessages();
    const issuer = makeIssuer();

    // The rule is send_message; step 2 declares issue_reward.
    await run(
      { actionType: "issue_reward", actionPayload: { amountRcn: 10 }, rule: rule({ actionType: "send_message" }) },
      messages,
      issuer
    );

    expect(issuer.calls[0]).toMatchObject({ rcnAmount: 10, customerAddress: "0xabc" });
    expect(messages.createMessage).not.toHaveBeenCalled();
  });

  it("uses the STEP's payload, not the rule's — they can differ", async () => {
    const issuer = makeIssuer();
    await run(
      {
        actionType: "issue_reward",
        actionPayload: { amountRcn: 10 },
        rule: rule({ actionType: "issue_reward", actionPayload: { amountRcn: 99 } }),
      },
      makeMessages(),
      issuer
    );
    expect(issuer.calls[0].rcnAmount).toBe(10);
  });

  it("a message STEP still sends a message even when the RULE is a reward rule", async () => {
    const messages = makeMessages();
    const issuer = makeIssuer();
    await run(
      {
        actionType: "send_message",
        messageText: "Leave us a review?",
        rule: rule({ actionType: "issue_reward", actionPayload: { amountRcn: 25 } }),
      },
      messages,
      issuer
    );
    expect(messages.created[0]).toMatchObject({ messageText: "Leave us a review?" });
    expect(issuer.issueExact).not.toHaveBeenCalled();
  });

  // Backward compatibility: every sequence written before A1 has steps with no actionType.
  it("a step with NO action falls back to the rule's action (pre-A1 sequences)", async () => {
    const messages = makeMessages();
    await run(
      { messageText: "Hi there", rule: rule({ actionType: "send_message" }) },
      messages,
      makeIssuer()
    );
    expect(messages.created[0]).toMatchObject({ messageText: "Hi there" });
  });

  it("falls all the way back to send_message when neither step nor rule declares one", async () => {
    const messages = makeMessages();
    await run(
      { messageText: "Hi", rule: rule({ actionType: undefined as any }) },
      messages,
      makeIssuer()
    );
    expect(messages.createMessage).toHaveBeenCalledTimes(1);
  });
});
