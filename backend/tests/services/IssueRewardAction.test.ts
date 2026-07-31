// Custom Workflows W2 — the first automation that does something other than send a message.
//
// The point of W1 was that this costs a handler and nothing else: no schema change beyond making the
// message optional, no edit to the scheduler's trigger/audience/timing logic.

import {
  IssueRewardAction,
  parseIssueRewardPayload,
  MAX_AUTOMATED_RCN,
} from "../../src/services/autoMessageActions/issueRewardAction";
import { AutoMessageActionRegistry } from "../../src/services/autoMessageActions/registry";
import { SendMessageAction } from "../../src/services/autoMessageActions/sendMessageAction";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";
import type { AutoMessageActionContext } from "../../src/services/autoMessageActions/types";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-r1",
  shopId: "peanut",
  name: "Thanks for coming back",
  messageTemplate: null, // a reward rule carries NO message (migration 248)
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
  actionType: "issue_reward",
  actionPayload: { amountRcn: 25 },
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  ...over,
});

const ctx = (over: Partial<AutoMessageActionContext> = {}): AutoMessageActionContext => ({
  rule: rule(),
  shopId: "peanut",
  customerAddress: "0xabc",
  customerName: "Mike",
  shopName: "Peanut Repairs",
  ...over,
});

const issuerOk = () => {
  const calls: any[] = [];
  return { calls, issueExact: jest.fn(async (a: any) => { calls.push(a); return { ok: true, txHash: "0xtx" }; }) };
};

describe("parseIssueRewardPayload — validated at write time, not just at fire time", () => {
  it("accepts a sane amount and trims the reason", () => {
    expect(parseIssueRewardPayload({ amountRcn: 25, reason: "  loyalty  " })).toEqual({
      amountRcn: 25,
      reason: "loyalty",
    });
  });

  it("rejects anything that isn't a positive number", () => {
    for (const bad of [null, undefined, {}, { amountRcn: 0 }, { amountRcn: -5 }, { amountRcn: "abc" }]) {
      expect(parseIssueRewardPayload(bad)).toBeNull();
    }
  });

  // A runaway rule must not be able to drain a shop's balance one automated send at a time.
  it("rejects an amount above the automated cap", () => {
    expect(parseIssueRewardPayload({ amountRcn: MAX_AUTOMATED_RCN })).not.toBeNull();
    expect(parseIssueRewardPayload({ amountRcn: MAX_AUTOMATED_RCN + 1 })).toBeNull();
  });
});

describe("IssueRewardAction", () => {
  it("issues the configured amount through the guarded issuance path", async () => {
    const issuer = issuerOk();
    const out = await new IssueRewardAction(issuer as any).execute(ctx());

    expect(out.ok).toBe(true);
    expect(issuer.calls[0]).toMatchObject({
      shopId: "peanut",
      customerAddress: "0xabc",
      rcnAmount: 25,
      source: "automation",
    });
  });

  it("produces no messageId — nothing was sent", async () => {
    const out = await new IssueRewardAction(issuerOk() as any).execute(ctx());
    expect(out.messageId).toBeUndefined();
    expect(out.conversationId).toBeUndefined();
  });

  it("uses the rule name as the reason when none is configured", async () => {
    const issuer = issuerOk();
    await new IssueRewardAction(issuer as any).execute(ctx());
    expect(issuer.calls[0].reason).toBe("Automation: Thanks for coming back");
  });

  // Insufficient shop balance / unregistered customer come back typed, not thrown. One shop being out
  // of RCN must not take down the scheduler tick for everyone else.
  it("reports a failed issuance without throwing", async () => {
    const issuer = { issueExact: jest.fn(async () => ({ ok: false, errorCode: "insufficient_balance" })) };
    await expect(new IssueRewardAction(issuer as any).execute(ctx())).resolves.toMatchObject({ ok: false });
  });

  it("refuses to fire on a misconfigured payload rather than issuing something arbitrary", async () => {
    const issuer = issuerOk();
    const out = await new IssueRewardAction(issuer as any).execute(
      ctx({ rule: rule({ actionPayload: { amountRcn: 99999 } }) })
    );
    expect(out.ok).toBe(false);
    expect(issuer.issueExact).not.toHaveBeenCalled();
  });
});

describe("registry — a reward rule routes past send_message entirely", () => {
  it("dispatches issue_reward to the reward handler, never touching messaging", async () => {
    const messages = {
      getOrCreateConversation: jest.fn(),
      createMessage: jest.fn(),
      incrementUnreadCount: jest.fn(),
    };
    const issuer = issuerOk();
    const reg = new AutoMessageActionRegistry([
      new SendMessageAction(messages as any),
      new IssueRewardAction(issuer as any),
    ]);

    const out = await reg.run(ctx());

    expect(out.ok).toBe(true);
    expect(issuer.issueExact).toHaveBeenCalledTimes(1);
    expect(messages.getOrCreateConversation).not.toHaveBeenCalled();
    expect(messages.createMessage).not.toHaveBeenCalled();
  });
});
