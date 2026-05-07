// backend/tests/ai-agent/TimePreferenceMatcher.test.ts
//
// Phase 3 Task 10 fix-4 — verify the keyword-based time-of-day matcher and
// the slot reorderer. The point of this layer is to flip Claude's
// "earliest-first" anchor to "preferred-first" so the prompt rules don't
// have to fight the model's recency bias.

import {
  bandForTime,
  detectTimePreference,
  reorderSlotsByPreference,
} from "../../src/domains/AIAgentDomain/services/TimePreferenceMatcher";

describe("bandForTime", () => {
  it.each([
    ["08:00", "morning"],
    ["09:30", "morning"],
    ["11:59", "morning"],
    ["12:00", "afternoon"],
    ["13:00", "afternoon"],
    ["16:30", "afternoon"],
    ["16:59", "afternoon"],
    ["17:00", "evening"],
    ["19:00", "evening"],
    ["23:30", "evening"],
  ])("classifies %s as %s", (time, expected) => {
    expect(bandForTime(time)).toBe(expected);
  });
});

describe("detectTimePreference", () => {
  it("detects 'afternoon'", () => {
    expect(detectTimePreference("Can I book Thursday afternoon?").band).toBe("afternoon");
  });

  it("detects 'morning'", () => {
    expect(detectTimePreference("any morning slots tomorrow?").band).toBe("morning");
  });

  it("detects 'evening'", () => {
    expect(detectTimePreference("evening would be perfect").band).toBe("evening");
    expect(detectTimePreference("can you fit me in tonight?").band).toBe("evening");
  });

  it("detects specific PM hours as afternoon", () => {
    expect(detectTimePreference("around 2 pm works").band).toBe("afternoon");
    expect(detectTimePreference("how about 3pm").band).toBe("afternoon");
  });

  it("detects specific AM hours as morning", () => {
    expect(detectTimePreference("9 am please").band).toBe("morning");
    expect(detectTimePreference("can i come in at 11am").band).toBe("morning");
  });

  it("detects evening from late-time hour mentions", () => {
    expect(detectTimePreference("how about 6 pm?").band).toBe("evening");
    expect(detectTimePreference("after 5 works").band).toBe("evening");
  });

  it("returns null when no preference is signaled", () => {
    expect(detectTimePreference("how much is this?").band).toBeNull();
    expect(detectTimePreference("can you describe the service?").band).toBeNull();
    expect(detectTimePreference("yes please").band).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectTimePreference("AFTERNOON please").band).toBe("afternoon");
    expect(detectTimePreference("Mornings work best").band).toBe("morning");
  });

  it("includes the matched phrase for diagnostics", () => {
    const r = detectTimePreference("Can I book Thursday afternoon?");
    expect(r.band).toBe("afternoon");
    expect(r.matchedPhrase).toBe("afternoon");
  });
});

describe("reorderSlotsByPreference", () => {
  // Helper: build a slot at a given HH:MM with a unique slotIso
  const slot = (time: string, label?: string) => ({
    date: "2026-05-08",
    time,
    slotIso: `2026-05-08T${time}:00.000Z-${time}`,
    humanLabel: label ?? `Friday at ${time}`,
  });

  const morningSlots = [slot("09:00"), slot("10:00"), slot("11:00")];
  const afternoonSlots = [slot("13:00"), slot("14:00"), slot("15:00")];
  const eveningSlots = [slot("17:00"), slot("18:00")];

  it("returns slots unchanged when no preference is detected", () => {
    const all = [...morningSlots, ...afternoonSlots];
    const result = reorderSlotsByPreference(all, "what does this service include?");
    expect(result.band).toBeNull();
    expect(result.slots).toEqual(all);
  });

  it("puts afternoon slots first when customer asks for afternoon", () => {
    const all = [...morningSlots, ...afternoonSlots, ...eveningSlots];
    const result = reorderSlotsByPreference(all, "Can I book Thursday afternoon?");
    expect(result.band).toBe("afternoon");
    // First 3 slots should be afternoon
    expect(result.slots.slice(0, 3).map((s) => s.time)).toEqual(["13:00", "14:00", "15:00"]);
    // Total length unchanged
    expect(result.slots).toHaveLength(8);
  });

  it("puts morning slots first when customer asks for morning", () => {
    const all = [...afternoonSlots, ...morningSlots]; // out of order on purpose
    const result = reorderSlotsByPreference(all, "morning would be perfect");
    expect(result.band).toBe("morning");
    expect(result.slots.slice(0, 3).map((s) => s.time)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("puts evening slots first when customer mentions tonight", () => {
    const all = [...morningSlots, ...afternoonSlots, ...eveningSlots];
    const result = reorderSlotsByPreference(all, "can you do tonight?");
    expect(result.band).toBe("evening");
    expect(result.slots.slice(0, 2).map((s) => s.time)).toEqual(["17:00", "18:00"]);
  });

  it("preserves original ordering inside the matching set (stable sort)", () => {
    // afternoonSlots are already in ascending order; reorder must keep them so
    const all = [...morningSlots, ...afternoonSlots];
    const result = reorderSlotsByPreference(all, "this afternoon");
    expect(result.slots.slice(0, 3).map((s) => s.time)).toEqual(["13:00", "14:00", "15:00"]);
  });

  it("falls back to original order when preference is detected but no slots match", () => {
    const onlyMorning = [...morningSlots];
    const result = reorderSlotsByPreference(onlyMorning, "Can I book Thursday afternoon?");
    expect(result.band).toBe("afternoon");
    // No afternoon slots exist — original order preserved so AI can offer
    // closest morning slot per the prompt's "say so honestly" rule
    expect(result.slots).toEqual(onlyMorning);
  });

  it("handles an empty slot list without crashing", () => {
    const result = reorderSlotsByPreference([], "afternoon please");
    expect(result.slots).toEqual([]);
    expect(result.band).toBe("afternoon");
  });
});
