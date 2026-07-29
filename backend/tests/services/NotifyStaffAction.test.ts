// The `notify_staff` action — the first automation action that talks to the SHOP, not the customer.
//
// It exists for more than variety: every trigger so far had to be customer-scoped, because messaging
// and rewards both need someone to send to. This is what makes shop-scoped triggers (low_stock) mean
// anything at all.

import { NotifyStaffAction, parseNotifyStaffPayload } from "../../src/services/autoMessageActions/notifyStaffAction";
import { AutoMessageActionRegistry } from "../../src/services/autoMessageActions/registry";
import { SendMessageAction } from "../../src/services/autoMessageActions/sendMessageAction";
import type { AutoMessage } from "../../src/repositories/AutoMessageRepository";
import type { AutoMessageActionContext } from "../../src/services/autoMessageActions/types";

const rule = (over: Partial<AutoMessage> = {}): AutoMessage => ({
  id: "rule-n1",
  shopId: "peanut",
  name: "No-show alert",
  messageTemplate: null,
  triggerType: "event",
  scheduleType: null,
  scheduleDayOfWeek: null,
  scheduleDayOfMonth: null,
  scheduleHour: 10,
  eventType: "no_show",
  delayHours: 0,
  targetAudience: "all",
  isActive: true,
  maxSendsPerCustomer: 1,
  steps: null,
  stopOnBooking: false,
  variantB: null,
  actionType: "notify_staff",
  actionPayload: null,
  surface: "workflow",
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  ...over,
});

const ctx = (over: Partial<AutoMessageActionContext> = {}): AutoMessageActionContext => ({
  rule: rule(),
  shopId: "peanut",
  customerAddress: "0xabc",
  customerName: "Qua Ting",
  shopName: "Peanut Repairs",
  ...over,
});

const gateway = () => {
  const calls: any[] = [];
  return { calls, dispatch: jest.fn(async (...a: any[]) => { calls.push(a); return null; }) };
};

describe("parseNotifyStaffPayload", () => {
  it("keeps a trimmed message", () => {
    expect(parseNotifyStaffPayload({ message: "  check this  " })).toEqual({ message: "check this" });
  });

  it("treats anything unusable as 'no custom message'", () => {
    for (const bad of [null, undefined, {}, { message: "   " }, { message: 42 }]) {
      expect(parseNotifyStaffPayload(bad)).toEqual({});
    }
  });

  it("caps the message so an alert can't be arbitrarily long", () => {
    const out = parseNotifyStaffPayload({ message: "x".repeat(900) });
    expect(out.message!.length).toBe(500);
  });
});

describe("NotifyStaffAction", () => {
  it("dispatches through the notification GATEWAY, not hand-wired channels", async () => {
    const g = gateway();
    const out = await new NotifyStaffAction(g as any).execute(
      ctx({ rule: rule({ actionPayload: { message: "Qua Ting no-showed — call them" } }) })
    );

    expect(out.ok).toBe(true);
    const [type, receiver, params] = g.calls[0];
    expect(type).toBe("workflow_staff_alert");
    expect(params.message).toBe("Qua Ting no-showed — call them");
  });

  // A shop login is frequently a social wallet that doesn't match shops.wallet_address, so a
  // wallet-addressed shop notification silently fails to reach the people who should see it.
  it("addresses the SHOP ID, never a wallet", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any).execute(ctx());
    expect(g.calls[0][1]).toBe("peanut");
  });

  it("falls back to a line built from the workflow name when no message is configured", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any).execute(ctx());
    expect(g.calls[0][2].message).toContain("No-show alert");
    expect(g.calls[0][2].message).toContain("Qua Ting");
  });

  it("carries the workflow + customer in metadata so the alert is actionable", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any).execute(ctx());
    expect(g.calls[0][2].metadata).toMatchObject({
      workflowName: "No-show alert",
      workflowId: "rule-n1",
      customerAddress: "0xabc",
    });
  });

  it("never throws — one shop's failed alert must not stop the tick", async () => {
    const g = { dispatch: jest.fn(async () => { throw new Error("gateway down"); }) };
    await expect(new NotifyStaffAction(g as any).execute(ctx())).resolves.toMatchObject({ ok: false });
  });

  it("produces no customer message", async () => {
    const messages = {
      getOrCreateConversation: jest.fn(),
      createMessage: jest.fn(),
      incrementUnreadCount: jest.fn(),
    };
    const g = gateway();
    const reg = new AutoMessageActionRegistry([
      new SendMessageAction(messages as any),
      new NotifyStaffAction(g as any),
    ]);
    const out = await reg.run(ctx({ actionType: "notify_staff" }));

    expect(out.ok).toBe(true);
    expect(out.messageId).toBeUndefined();
    expect(messages.createMessage).not.toHaveBeenCalled();
  });
});
