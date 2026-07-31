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

/** Team roster stub. Default: nobody, so the shop-level alert is the only delivery. */
const team = (members: any[] = []) => ({ getMembersByShop: jest.fn(async () => members) });

const member = (over: Partial<{ walletAddress: string | null; status: string; permissions: string[]; role: string }> = {}) => ({
  walletAddress: '0xteam1',
  status: 'active',
  permissions: ['inventory:view', 'bookings:view'],
  role: 'staff',
  ...over,
});

/** Every address the gateway was asked to notify. */
const receivers = (g: ReturnType<typeof gateway>) => g.calls.map((c) => c[1]);

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
    const out = await new NotifyStaffAction(g as any, team() as any).execute(
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
    await new NotifyStaffAction(g as any, team() as any).execute(ctx());
    expect(g.calls[0][1]).toBe("peanut");
  });

  it("falls back to a line built from the workflow name when no message is configured", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team() as any).execute(ctx());
    expect(g.calls[0][2].message).toContain("No-show alert");
    expect(g.calls[0][2].message).toContain("Qua Ting");
  });

  it("carries the workflow + customer in metadata so the alert is actionable", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team() as any).execute(ctx());
    expect(g.calls[0][2].metadata).toMatchObject({
      workflowName: "No-show alert",
      workflowId: "rule-n1",
      customerAddress: "0xabc",
    });
  });

  it("never throws — one shop's failed alert must not stop the tick", async () => {
    const g = { dispatch: jest.fn(async () => { throw new Error("gateway down"); }) };
    await expect(new NotifyStaffAction(g as any, team() as any).execute(ctx())).resolves.toMatchObject({ ok: false });
  });

  // The alert used to echo only what the owner typed when they BUILT the workflow — "stock is running
  // low" — which is the one thing they already know. The useful part is which items.
  it("leads with the live trigger detail, then the owner's note", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team() as any).execute(
      ctx({
        triggerDetail: "Low stock: iPhone 14 screen, battery and 2 more.",
        rule: rule({ eventType: "low_stock", actionPayload: { message: "Worth reordering." } }),
      })
    );
    expect(g.calls[0][2].message).toBe("Low stock: iPhone 14 screen, battery and 2 more. Worth reordering.");
  });

  it("uses the detail alone when no note is configured", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team() as any).execute(
      ctx({ triggerDetail: "Low stock: battery.", rule: rule({ eventType: "low_stock" }) })
    );
    expect(g.calls[0][2].message).toBe("Low stock: battery.");
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
      new NotifyStaffAction(g as any, team() as any),
    ]);
    const out = await reg.run(ctx({ actionType: "notify_staff" }));

    expect(out.ok).toBe(true);
    expect(out.messageId).toBeUndefined();
    expect(messages.createMessage).not.toHaveBeenCalled();
  });
});

// Dispatching only to shopId LOOKED right and mostly didn't work: the in-app bell resolves it (the
// query is [walletAddress, shopId]) but sockets are keyed by address and push tokens by wallet, so
// neither reached anyone — and the whole shop shared one notification row, so one person reading it
// marked it read for everybody. Fanning out to real member wallets fixes all three.
describe("NotifyStaffAction — team fan-out (Business Team Management)", () => {
  it("notifies the shop AND each active team member individually", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team([member({ walletAddress: "0xTEAM1" })]) as any).execute(ctx());
    expect(receivers(g)).toEqual(["peanut", "0xteam1"]);
  });

  it("skips invited members — they have an email but no wallet to address yet", async () => {
    const g = gateway();
    await new NotifyStaffAction(
      g as any,
      team([member({ status: "invited", walletAddress: null })]) as any
    ).execute(ctx());
    expect(receivers(g)).toEqual(["peanut"]);
  });

  it("skips suspended members", async () => {
    const g = gateway();
    await new NotifyStaffAction(g as any, team([member({ status: "suspended" })]) as any).execute(ctx());
    expect(receivers(g)).toEqual(["peanut"]);
  });

  // A low-stock alert should reach people who handle inventory, not everyone with a login.
  it("only notifies members holding the permission the trigger calls for", async () => {
    const g = gateway();
    await new NotifyStaffAction(
      g as any,
      team([
        member({ walletAddress: "0xstock", permissions: ["inventory:view"] }),
        member({ walletAddress: "0xnostock", permissions: ["bookings:view"] }),
      ]) as any
    ).execute(ctx({ rule: rule({ eventType: "low_stock" }) }));

    expect(receivers(g)).toEqual(["peanut", "0xstock"]);
  });

  it("always notifies an owner, whatever the trigger's permission", async () => {
    const g = gateway();
    await new NotifyStaffAction(
      g as any,
      team([member({ walletAddress: "0xowner", role: "owner", permissions: [] })]) as any
    ).execute(ctx({ rule: rule({ eventType: "low_stock" }) }));
    expect(receivers(g)).toEqual(["peanut", "0xowner"]);
  });

  it("notifies everyone when the trigger has no natural permission", async () => {
    const g = gateway();
    await new NotifyStaffAction(
      g as any,
      team([member({ walletAddress: "0xa", permissions: [] })]) as any
    ).execute(ctx({ rule: rule({ eventType: "some_future_trigger" }) }));
    expect(receivers(g)).toEqual(["peanut", "0xa"]);
  });

  // Fails OPEN: better to send the shop-level alert than to go silent because a lookup broke.
  it("still sends the shop alert when the team lookup fails", async () => {
    const g = gateway();
    const broken = { getMembersByShop: jest.fn(async () => { throw new Error("db down"); }) };
    const out = await new NotifyStaffAction(g as any, broken as any).execute(ctx());
    expect(out.ok).toBe(true);
    expect(receivers(g)).toEqual(["peanut"]);
  });

  it("one teammate's failed dispatch doesn't stop the others", async () => {
    const calls: any[] = [];
    const g = {
      calls,
      dispatch: jest.fn(async (...a: any[]) => {
        calls.push(a);
        if (a[1] === "0xbad") throw new Error("push exploded");
        return null;
      }),
    };
    const out = await new NotifyStaffAction(
      g as any,
      team([member({ walletAddress: "0xbad" }), member({ walletAddress: "0xgood" })]) as any
    ).execute(ctx());

    expect(out.ok).toBe(true);
    expect(calls.map((c) => c[1])).toEqual(["peanut", "0xbad", "0xgood"]);
  });
});
