// backend/tests/ai-agent/AvailabilityFetcher.test.ts
//
// Unit tests for AvailabilityFetcher. Two clusters:
//   - clampLookahead bounds (originally added with the dynamic-lookahead PR)
//   - Dynamic slot cap: include all slots when total ≤ ceiling, apply
//     per-day cap when total exceeds it (so wide windows still represent
//     every day fairly).

import { AvailabilityFetcher, clampLookahead } from "../../src/domains/AIAgentDomain/services/AvailabilityFetcher";

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

describe("AvailabilityFetcher.fetchUpcomingSlots — dynamic slot cap", () => {
  // Each day's getAvailableTimeSlots returns this many `available: true`
  // slots, named "09:00", "10:00", ... so we can spot which day a slot
  // came from in the final output.
  function makeFetcher(opts: {
    slotsPerDay: number[]; // Length = lookaheadDays; index 0 = today
    bookingAdvanceDays?: number;
  }) {
    const appointmentService = {
      getAvailableTimeSlots: jest.fn(async (_shopId, _serviceId, date) => {
        // Find which day this is (date string maps to index in slotsPerDay)
        const dates = opts.slotsPerDay.map((_, i) => addDays(i));
        const idx = dates.indexOf(date);
        if (idx < 0) return [];
        const count = opts.slotsPerDay[idx];
        return Array.from({ length: count }, (_, i) => ({
          time: `${String(9 + i).padStart(2, "0")}:00`,
          available: true,
        }));
      }),
    };
    const appointmentRepo = {
      getTimeSlotConfig: jest.fn(async () => ({
        configId: "cfg_x",
        shopId: "peanut",
        slotDurationMinutes: 45,
        bufferTimeMinutes: 15,
        maxConcurrentBookings: 1,
        bookingAdvanceDays: opts.bookingAdvanceDays ?? opts.slotsPerDay.length,
        minBookingHours: 0,
        allowWeekendBooking: true,
        timezone: "America/New_York",
        createdAt: "",
        updatedAt: "",
      })),
    };
    return new AvailabilityFetcher({
      appointmentService: appointmentService as any,
      appointmentRepo: appointmentRepo as any,
    });
  }

  function addDays(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  it("returns ALL slots when total fits under the ceiling (typical 6-day shop)", async () => {
    // 6 days × 9 slots = 54 slots, well under the 100 ceiling. Every day
    // should be fully represented — this matches what the manual booking
    // page shows.
    const fetcher = makeFetcher({ slotsPerDay: [9, 9, 9, 9, 9, 9] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main");
    expect(slots).toHaveLength(54);
    // Verify each day got all 9 of its slots (sanity check on distribution)
    const byDate = slots.reduce<Record<string, number>>((acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.values(byDate)).toEqual([9, 9, 9, 9, 9, 9]);
  });

  it("preserves earliest-first ordering when including all slots", async () => {
    const fetcher = makeFetcher({ slotsPerDay: [3, 3, 3] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main");
    expect(slots).toHaveLength(9);
    // Slot[0] is from day 0; slot[3] is from day 1; etc.
    expect(slots[0].date).toBe(addDays(0));
    expect(slots[3].date).toBe(addDays(1));
    expect(slots[6].date).toBe(addDays(2));
  });

  it("applies per-day cap when total exceeds the ceiling (wide window)", async () => {
    // 20 days × 12 slots = 240 total. Ceiling is 100.
    // perDayCap = ceil(100/20) = 5. So 20 × 5 = 100 slots, balanced.
    const fetcher = makeFetcher({
      slotsPerDay: Array(20).fill(12),
      bookingAdvanceDays: 20,
    });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main");
    expect(slots.length).toBeLessThanOrEqual(100);
    const byDate = slots.reduce<Record<string, number>>((acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + 1;
      return acc;
    }, {});
    // Every one of the 20 days should be represented — that's the whole
    // point of the per-day cap. No day gets dropped to zero.
    expect(Object.keys(byDate)).toHaveLength(20);
    // Each day should have ≥ 2 slots (the per-day floor) and ≤ 5 (the cap)
    for (const count of Object.values(byDate)) {
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it("includes Thursday's slots when customer asks about Thursday (the original bug)", async () => {
    // Reproduces the staging bug: 6-day window with ~9 slots/day, customer
    // asks about Thursday May 14 (day 3 of the window). With the old
    // MAX_SLOTS=15, Thursday got truncated. Now it should be visible.
    // Days: today, +1, +2, +3 (Thursday), +4, +5
    const fetcher = makeFetcher({ slotsPerDay: [9, 9, 9, 9, 9, 9] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main");
    const day3Date = addDays(3);
    const day3Slots = slots.filter((s) => s.date === day3Date);
    expect(day3Slots.length).toBeGreaterThan(0);
    expect(day3Slots).toHaveLength(9);
  });

  it("returns empty array when shop has no slots configured", async () => {
    const fetcher = makeFetcher({ slotsPerDay: [0, 0, 0, 0, 0, 0] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main");
    expect(slots).toEqual([]);
  });

  // ----- Per-customer no-show advance-notice floor -----
  //
  // A customer on a no-show restriction tier (caution = 24h,
  // deposit_required = 48h) must only be offered slots far enough out, or
  // the AI proposes a slot the checkout then rejects ("Booking Time Too
  // Soon"). minAdvanceHours is the 4th arg.

  it("returns ALL slots when minAdvanceHours is 0 (unrestricted customer)", async () => {
    const fetcher = makeFetcher({ slotsPerDay: [9, 9, 9, 9, 9, 9] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main", "srv_main", 0);
    expect(slots).toHaveLength(54);
  });

  it("drops EVERY slot when minAdvanceHours exceeds the whole window", async () => {
    // 3-day window, 240-hour (10-day) floor → nothing in the window
    // satisfies it. The AI then gets zero slots and won't propose a card.
    const fetcher = makeFetcher({ slotsPerDay: [6, 6, 6] });
    const slots = await fetcher.fetchUpcomingSlots("peanut", "srv_main", "srv_main", 240);
    expect(slots).toEqual([]);
  });

  it("only returns slots at least minAdvanceHours out from now", async () => {
    // 30-day window with a 48-hour floor. Near slots (today/tomorrow) are
    // dropped; far slots survive. Assert the invariant directly so the
    // test is deterministic regardless of the time of day it runs.
    const fetcher = makeFetcher({
      slotsPerDay: Array(30).fill(4),
      bookingAdvanceDays: 30,
    });
    const minAdvanceHours = 48;
    const slots = await fetcher.fetchUpcomingSlots(
      "peanut",
      "srv_main",
      "srv_main",
      minAdvanceHours
    );
    // Far days easily clear 48h, so some slots must survive.
    expect(slots.length).toBeGreaterThan(0);
    // Every surviving slot must start at least 48h from now.
    const cutoffMs = Date.now() + minAdvanceHours * 3_600_000;
    for (const s of slots) {
      expect(Date.parse(s.slotIso)).toBeGreaterThanOrEqual(cutoffMs);
    }
  });

  it("forwards minAdvanceHours through fetchUpcomingSlotsForServices", async () => {
    const fetcher = makeFetcher({
      slotsPerDay: Array(30).fill(4),
      bookingAdvanceDays: 30,
    });
    const minAdvanceHours = 48;
    const slots = await fetcher.fetchUpcomingSlotsForServices(
      "peanut",
      [{ serviceId: "srv_main", serviceName: "Oil Change" }],
      minAdvanceHours
    );
    expect(slots.length).toBeGreaterThan(0);
    const cutoffMs = Date.now() + minAdvanceHours * 3_600_000;
    for (const s of slots) {
      expect(Date.parse(s.slotIso)).toBeGreaterThanOrEqual(cutoffMs);
    }
  });
});
