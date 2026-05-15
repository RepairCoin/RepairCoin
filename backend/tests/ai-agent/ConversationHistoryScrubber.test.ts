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
  // Post-2026-05-15: scrubbing is GATED on metadata.booking_suggestions.
  // Only assistant messages that actually proposed a slot are scrubbed —
  // the original copy-paste bug (Claude re-suggesting a stale slot time)
  // only happens with those. Messages that mention a time but aren't slot
  // proposals (shop hours, durations) are left intact.

  const slotMeta = {
    booking_suggestions: [
      { serviceId: "srv_x", slotIso: "2026-05-15T13:00:00.000Z" },
    ],
  };

  it("scrubs an assistant message that PROPOSED a slot (has booking_suggestions)", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: "How does Thursday at 9:00 AM sound? Tap below to lock it in.",
        metadata: slotMeta,
      },
    ];
    const result = scrubAssistantHistory(messages);
    expect(result[0].content).toBe(
      `How does Thursday at ${PLACEHOLDER} sound? Tap below to lock it in.`
    );
  });

  it("does NOT scrub an assistant message WITHOUT booking_suggestions (shop hours)", () => {
    // The exact staging bug: a shop-hours answer mentions many times but
    // proposed no slot. It must reach Claude verbatim — otherwise Claude
    // reads "[earlier suggested time]" placeholders, thinks it never
    // answered, and re-dumps the hours.
    const hoursReply =
      "Our shop hours are: Sunday 9:00 AM - 6:00 PM, Friday 9:00 AM - 5:00 PM, Saturday Closed.";
    const messages = [
      { role: "assistant" as const, content: hoursReply, metadata: { generated_by: "ai_agent" } },
    ];
    const result = scrubAssistantHistory(messages);
    expect(result[0].content).toBe(hoursReply); // untouched
  });

  it("does NOT scrub an assistant message with empty booking_suggestions array", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: "We're open until 6 PM today.",
        metadata: { booking_suggestions: [] },
      },
    ];
    expect(scrubAssistantHistory(messages)[0].content).toBe(
      "We're open until 6 PM today."
    );
  });

  it("does NOT scrub an assistant message with no metadata at all", () => {
    const messages = [
      { role: "assistant" as const, content: "Come by before 5 PM." },
    ];
    expect(scrubAssistantHistory(messages)[0].content).toBe("Come by before 5 PM.");
  });

  it("leaves user messages alone even when they mention times", () => {
    const messages = [
      { role: "user" as const, content: "Can I book Thursday at 2 PM?" },
      {
        role: "assistant" as const,
        content: "How about 9 AM instead?",
        metadata: slotMeta,
      },
    ];
    const result = scrubAssistantHistory(messages);
    expect(result[0].content).toBe("Can I book Thursday at 2 PM?"); // verbatim
    expect(result[1].content).toBe(`How about ${PLACEHOLDER} instead?`); // scrubbed
  });

  it("strips metadata from the output (returns plain ChatMessage shape)", () => {
    const messages = [
      { role: "assistant" as const, content: "Hi there!", metadata: slotMeta },
    ];
    const result = scrubAssistantHistory(messages);
    expect(result[0]).toEqual({ role: "assistant", content: "Hi there!" });
    expect((result[0] as any).metadata).toBeUndefined();
  });

  it("does not mutate the input array or its messages", () => {
    const original = "How does 9 AM sound?";
    const messages = [
      { role: "assistant" as const, content: original, metadata: slotMeta },
    ];
    scrubAssistantHistory(messages);
    expect(messages[0].content).toBe(original);
  });

  it("handles an empty history without crashing", () => {
    expect(scrubAssistantHistory([])).toEqual([]);
  });

  it("mixed history: scrubs only the slot-proposal turns", () => {
    const messages = [
      { role: "user" as const, content: "what are your hours?" },
      {
        role: "assistant" as const,
        content: "We're open 9 AM to 6 PM.",
        metadata: { generated_by: "ai_agent" }, // hours answer, no slot
      },
      { role: "user" as const, content: "book me in" },
      {
        role: "assistant" as const,
        content: "Friday at 2:30 PM works!",
        metadata: slotMeta, // slot proposal
      },
    ];
    const result = scrubAssistantHistory(messages);
    expect(result[0].content).toBe("what are your hours?");
    expect(result[1].content).toBe("We're open 9 AM to 6 PM."); // NOT scrubbed
    expect(result[2].content).toBe("book me in");
    expect(result[3].content).toBe(`Friday at ${PLACEHOLDER} works!`); // scrubbed
  });
});
