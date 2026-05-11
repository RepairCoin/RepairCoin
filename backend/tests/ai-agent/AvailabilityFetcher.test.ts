// backend/tests/ai-agent/AvailabilityFetcher.test.ts
//
// Focused unit tests for the dynamic-lookahead clamp logic added when we
// replaced the hardcoded LOOKAHEAD_DAYS=3 with the shop's configured
// booking_advance_days. Full end-to-end fetchUpcomingSlots integration is
// covered by the orchestrator + e2e smoke flows; here we just verify the
// safety bounds + defaults.

import { clampLookahead } from "../../src/domains/AIAgentDomain/services/AvailabilityFetcher";

describe("AvailabilityFetcher.clampLookahead", () => {
  it("returns the input when within bounds", () => {
    expect(clampLookahead(1)).toBe(1);
    expect(clampLookahead(7)).toBe(7);
    expect(clampLookahead(14)).toBe(14);
    expect(clampLookahead(30)).toBe(30);
  });

  it("clamps values below the minimum (1)", () => {
    // Shop configured 0 or a negative number — still want today's slots in
    // the prompt rather than an empty window.
    expect(clampLookahead(0)).toBe(1);
    expect(clampLookahead(-5)).toBe(1);
  });

  it("clamps values above the maximum (30)", () => {
    // Shop misconfigured booking_advance_days=365 would otherwise trigger
    // 365 parallel DB queries per AI reply. 30 is a safe operational ceiling.
    expect(clampLookahead(31)).toBe(30);
    expect(clampLookahead(365)).toBe(30);
    expect(clampLookahead(10000)).toBe(30);
  });

  it("floors fractional inputs", () => {
    expect(clampLookahead(6.7)).toBe(6);
    expect(clampLookahead(1.99)).toBe(1);
  });

  it("returns the default (7) for non-finite inputs", () => {
    // Non-finite check runs first, so NaN and Infinity both fall back to
    // the default rather than getting clamped to a bound.
    expect(clampLookahead(NaN)).toBe(7);
    expect(clampLookahead(Infinity)).toBe(7);
    expect(clampLookahead(-Infinity)).toBe(7);
  });
});
