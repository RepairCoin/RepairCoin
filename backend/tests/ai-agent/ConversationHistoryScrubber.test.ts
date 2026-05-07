// backend/tests/ai-agent/ConversationHistoryScrubber.test.ts
//
// Phase 3 Task 10 fix-5 — verify scrubbing of specific time mentions from
// past assistant messages so Claude doesn't copy-paste its own previous
// slot suggestions.

import {
  scrubSpecificTimes,
  scrubAssistantHistory,
} from "../../src/domains/AIAgentDomain/services/ConversationHistoryScrubber";

const PLACEHOLDER = "[earlier suggested time]";

describe("scrubSpecificTimes", () => {
  it("replaces 'HH AM' / 'HH PM' (no minutes, with space)", () => {
    expect(scrubSpecificTimes("How about 9 AM?")).toBe(`How about ${PLACEHOLDER}?`);
    expect(scrubSpecificTimes("Try 6 PM tomorrow.")).toBe(`Try ${PLACEHOLDER} tomorrow.`);
  });

  it("replaces 'HHam' / 'HHpm' (no minutes, no space)", () => {
    expect(scrubSpecificTimes("9am works")).toBe(`${PLACEHOLDER} works`);
    expect(scrubSpecificTimes("3pm sharp")).toBe(`${PLACEHOLDER} sharp`);
  });

  it("replaces 'HH:MM AM/PM' variants", () => {
    expect(scrubSpecificTimes("9:00 AM Thursday")).toBe(`${PLACEHOLDER} Thursday`);
    expect(scrubSpecificTimes("at 10:30 PM")).toBe(`at ${PLACEHOLDER}`);
    expect(scrubSpecificTimes("I'll see you 2:15PM")).toBe(`I'll see you ${PLACEHOLDER}`);
  });

  it("replaces dotted forms like 'a.m.' / 'p.m.'", () => {
    expect(scrubSpecificTimes("at 9 a.m. on Thursday")).toBe(
      `at ${PLACEHOLDER} on Thursday`
    );
    expect(scrubSpecificTimes("3:00 P.M.")).toBe(PLACEHOLDER);
  });

  it("is case-insensitive", () => {
    expect(scrubSpecificTimes("9 am Thursday")).toBe(`${PLACEHOLDER} Thursday`);
    expect(scrubSpecificTimes("9 Am Thursday")).toBe(`${PLACEHOLDER} Thursday`);
    expect(scrubSpecificTimes("9 AM Thursday")).toBe(`${PLACEHOLDER} Thursday`);
  });

  it("handles multiple time mentions in one string", () => {
    const result = scrubSpecificTimes(
      "How does 9 AM or 2:30 PM sound?"
    );
    expect(result).toBe(`How does ${PLACEHOLDER} or ${PLACEHOLDER} sound?`);
  });

  it("preserves the rest of the sentence (only times are replaced)", () => {
    const before = "How does Thursday at 9:00 AM sound? Tap below to lock it in.";
    const after = `How does Thursday at ${PLACEHOLDER} sound? Tap below to lock it in.`;
    expect(scrubSpecificTimes(before)).toBe(after);
  });

  it("does NOT match digits without AM/PM suffix", () => {
    // Bare numbers ("9 questions", "$99") must survive untouched
    expect(scrubSpecificTimes("9 questions answered")).toBe("9 questions answered");
    expect(scrubSpecificTimes("$99.00 service")).toBe("$99.00 service");
    expect(scrubSpecificTimes("we have 12 slots open")).toBe("we have 12 slots open");
  });

  it("returns the input unchanged when no time pattern exists", () => {
    const text = "We have availability across the day. Tap below to book.";
    expect(scrubSpecificTimes(text)).toBe(text);
  });

  it("handles empty/null-ish inputs safely", () => {
    expect(scrubSpecificTimes("")).toBe("");
  });
});

describe("scrubAssistantHistory", () => {
  it("scrubs assistant messages but leaves user messages alone", () => {
    const messages = [
      { role: "user" as const, content: "Can I book Thursday afternoon at 2 PM?" },
      { role: "assistant" as const, content: "How does Thursday at 9:00 AM sound?" },
      { role: "user" as const, content: "I'd prefer 3 PM" },
      { role: "assistant" as const, content: "Sure, 3 PM works! Tap below to lock it in." },
    ];
    const result = scrubAssistantHistory(messages);

    // User messages survive verbatim — including their own time mentions
    expect(result[0].content).toBe("Can I book Thursday afternoon at 2 PM?");
    expect(result[2].content).toBe("I'd prefer 3 PM");

    // Assistant times are scrubbed
    expect(result[1].content).toBe(`How does Thursday at ${PLACEHOLDER} sound?`);
    expect(result[3].content).toBe(`Sure, ${PLACEHOLDER} works! Tap below to lock it in.`);
  });

  it("returns the same message object reference when nothing changes", () => {
    // No-op scrubs preserve identity — small allocation win, also a useful
    // signal that nothing was touched
    const noTimeMsg = { role: "assistant" as const, content: "Sounds good!" };
    const messages = [noTimeMsg];
    const result = scrubAssistantHistory(messages);
    expect(result[0]).toBe(noTimeMsg); // Identity-equal, not just deep-equal
  });

  it("does not mutate the input array or its messages", () => {
    const original = "How does 9 AM sound?";
    const messages = [{ role: "assistant" as const, content: original }];
    scrubAssistantHistory(messages);
    expect(messages[0].content).toBe(original);
  });

  it("handles an empty history without crashing", () => {
    expect(scrubAssistantHistory([])).toEqual([]);
  });

  it("scrubs ALL assistant messages in a long history (not just the most recent)", () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Reply ${i} at ${i + 9} AM.`,
    }));
    const result = scrubAssistantHistory(messages);

    // user (i=0): content kept verbatim ("Reply 0 at 9 AM.")
    expect(result[0].content).toBe("Reply 0 at 9 AM.");
    // assistant (i=1): scrubbed
    expect(result[1].content).toBe(`Reply 1 at ${PLACEHOLDER}.`);
    // user (i=2)
    expect(result[2].content).toBe("Reply 2 at 11 AM.");
    // assistant (i=3): scrubbed
    expect(result[3].content).toBe(`Reply 3 at ${PLACEHOLDER}.`);
    // user (i=4)
    expect(result[4].content).toBe("Reply 4 at 13 AM.");
  });
});
