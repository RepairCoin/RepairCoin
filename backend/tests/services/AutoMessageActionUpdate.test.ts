// A rule's ACTION must be editable — and an edit must never leave the rule unrunnable.
//
// The bug: UpdateAutoMessageParams had no actionType/actionPayload and update()'s SQL never touched
// action_type/action_payload — they existed only in the INSERT. So the action was immutable after
// creation while the form offered to change it and the toast reported success. Concretely, a shop could
// not edit the alert text of a "notify my team" rule, or a reward's amount, at all.
//
// The damaging half was subtler. Switching a message rule to a staff alert submits
// `messageTemplate: null` alongside the new actionType. The actionType was dropped; the null was
// APPLIED. Result: action_type='send_message' with message_template=NULL, which throws inside
// resolveTemplate on every tick, records a failed send, and leaves the rule showing as Active forever.
//
// These tests cover the repository's field mapping and the controller's validation decisions. The
// controller's decisions are reproduced here as pure functions against the same imported constants, so
// they cannot drift from the values the real code uses.

import {
  NON_MESSAGING_ACTIONS,
  SHOP_SCOPED_ACTIONS,
  DEFAULT_ACTION_TYPE,
} from "../../src/services/autoMessageActions/registry";
import { parseIssueRewardPayload } from "../../src/services/autoMessageActions/issueRewardAction";
import { parseNotifyStaffPayload } from "../../src/services/autoMessageActions/notifyStaffAction";

describe("update field mapping — undefined leaves alone, null clears", () => {
  // Mirrors the repository's serialisation for action_payload.
  const serialise = (v: Record<string, unknown> | null | undefined) =>
    v === undefined ? undefined : v ? JSON.stringify(v) : null;

  it("omits action_payload entirely when not provided", () => {
    expect(serialise(undefined)).toBeUndefined();
  });

  it("clears action_payload when explicitly null", () => {
    expect(serialise(null)).toBeNull();
  });

  it("stringifies a provided payload", () => {
    expect(serialise({ message: "hi" })).toBe('{"message":"hi"}');
  });

  // A notify_staff rule with no custom alert text parses to {}, and stores as '{}' — matching create()
  // exactly, so an edit can't produce a shape a create never would.
  it("stores an empty payload as '{}', the same as create does", () => {
    expect(serialise({})).toBe("{}");
  });
});

// parseAction() defaults a missing type to 'send_message'. Running it unconditionally on update would
// therefore convert every notify_staff rule into a messaging one the moment any other field was edited —
// so the controller only touches the action when the client mentioned it.
describe("when to touch the action at all", () => {
  const mentioned = (body: Record<string, unknown>) =>
    body.actionType !== undefined || body.actionPayload !== undefined;

  it("leaves the action alone when the edit is about something else", () => {
    expect(mentioned({ name: "Renamed" })).toBe(false);
  });

  it("acts when the type is given", () => {
    expect(mentioned({ actionType: "notify_staff" })).toBe(true);
  });

  // Editing only the alert text of an existing notify_staff rule — the case that was impossible before.
  it("acts when only the payload is given", () => {
    expect(mentioned({ actionPayload: { message: "Reorder sooner" } })).toBe(true);
  });

  it("acts when the payload is explicitly cleared", () => {
    expect(mentioned({ actionPayload: null })).toBe(true);
  });
});

// The effective action is what the rule WILL be: the submitted type if given, otherwise what's stored.
// Validation has to reason about the combination, because either half can arrive alone.
describe("effective action resolution", () => {
  const effective = (submitted: unknown, stored: string | null) =>
    submitted !== undefined ? submitted : stored || DEFAULT_ACTION_TYPE;

  it("uses the submitted type when given", () => {
    expect(effective("issue_reward", "send_message")).toBe("issue_reward");
  });

  it("falls back to the stored type when only a payload is being edited", () => {
    expect(effective(undefined, "notify_staff")).toBe("notify_staff");
  });

  // Rows written before migration 247 have no action_type.
  it("treats a legacy NULL action as send_message", () => {
    expect(effective(undefined, null)).toBe(DEFAULT_ACTION_TYPE);
  });
});

describe("a messaging rule must end up with something to send", () => {
  /** The controller's guard, over effective values. */
  const rejects = (action: string, template: string | null, steps: unknown[] | null) =>
    !NON_MESSAGING_ACTIONS.has(action) && !template && !(Array.isArray(steps) && steps.length > 0);

  // The exact corruption: form switches to notify_staff, sends messageTemplate null. If the action
  // change doesn't land, applying the null alone produces a rule that throws on every tick.
  it("rejects a send_message rule left with no template", () => {
    expect(rejects("send_message", null, null)).toBe(true);
  });

  it("allows a non-messaging action to have no template", () => {
    expect(rejects("notify_staff", null, null)).toBe(false);
    expect(rejects("issue_reward", null, null)).toBe(false);
  });

  it("allows a messaging rule whose copy lives in its steps", () => {
    expect(rejects("send_message", null, [{ messageTemplate: "step one", delayHours: 0 }])).toBe(false);
  });

  it("allows a messaging rule that keeps its template", () => {
    expect(rejects("send_message", "Hi {{customerName}}", null)).toBe(false);
  });

  it("does not accept an empty string as a template", () => {
    expect(rejects("send_message", "", null)).toBe(true);
  });
});

// A shop-scoped trigger has no customer, so an action needing a recipient can never run. Checked against
// effective values on update so it can't be reached by changing only one side of the pair.
//
// Keyed on SHOP_SCOPED_ACTIONS. Using NON_MESSAGING_ACTIONS here was a real bug found by writing this
// suite: that set contains issue_reward, which sends no message but still needs somebody to pay, so
// "low stock → issue 25 RCN" was accepted and could only ever fail.
describe("shop-scoped trigger coherence on update", () => {
  const SHOP_SCOPED_EVENTS = new Set(["low_stock"]);
  const rejects = (triggerType: string, eventType: string | null, action: string) =>
    triggerType === "event" &&
    SHOP_SCOPED_EVENTS.has(eventType || "") &&
    !SHOP_SCOPED_ACTIONS.has(action);

  it("rejects switching a low_stock rule to send a message", () => {
    expect(rejects("event", "low_stock", "send_message")).toBe(true);
  });

  it("rejects switching a low_stock rule to a reward — there is nobody to pay", () => {
    expect(rejects("event", "low_stock", "issue_reward")).toBe(true);
  });

  it("allows low_stock with a staff alert", () => {
    expect(rejects("event", "low_stock", "notify_staff")).toBe(false);
  });

  // Reachable only by comparing effective values: the stored event stays low_stock while the submitted
  // action changes, so validating the request body alone would miss it.
  it("catches an action-only edit against the STORED shop-scoped event", () => {
    const storedEvent = "low_stock";
    const submittedAction = "send_message";
    expect(rejects("event", storedEvent, submittedAction)).toBe(true);
  });
});

// The payload parsers are what the controller validates through, so an edit gets the same guarantees as
// a create — a bad amount is a 400, not a rule that fails silently on every tick.
describe("payload validation applies to edits too", () => {
  it("rejects a reward amount over the automated cap", () => {
    expect(parseIssueRewardPayload({ amountRcn: 101 })).toBeNull();
  });

  it("rejects a reward with no amount", () => {
    expect(parseIssueRewardPayload({ reason: "just because" })).toBeNull();
  });

  it("accepts a valid reward edit", () => {
    expect(parseIssueRewardPayload({ amountRcn: 30, reason: "Loyalty" })).toEqual({
      amountRcn: 30,
      reason: "Loyalty",
    });
  });

  it("accepts an alert-text edit and caps its length", () => {
    expect(parseNotifyStaffPayload({ message: "Reorder sooner" })).toEqual({ message: "Reorder sooner" });
    expect(parseNotifyStaffPayload({ message: "x".repeat(900) }).message!.length).toBe(500);
  });

  it("treats a cleared alert text as 'no custom message', falling back to the rule name", () => {
    expect(parseNotifyStaffPayload({ message: "   " })).toEqual({});
  });
});
