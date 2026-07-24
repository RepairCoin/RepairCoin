// backend/tests/utils/shopQuietHours.test.ts
//
// The shop-local daytime window shared by both follow-up paths. Time is frozen
// and the zone is UTC so the arithmetic is deterministic; DST-shifting zones are
// exercised separately.

import {
  DAYTIME_START_HOUR,
  DAYTIME_END_HOUR,
  shopLocalHour,
  isWithinShopDaytime,
  hoursUntilShopDaytime,
} from "../../src/utils/shopQuietHours";

/** Freeze the clock at a given UTC hour. */
function atUtcHour(hour: number): void {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(Date.UTC(2026, 6, 24, hour, 30, 0)));
}

afterEach(() => {
  jest.useRealTimers();
});

describe("shopLocalHour", () => {
  it("reads the hour in the given zone", () => {
    atUtcHour(15);
    expect(shopLocalHour("UTC")).toBe(15);
    expect(shopLocalHour("Asia/Manila")).toBe(23); // UTC+8
  });

  it("falls back to midday on an invalid zone rather than muting follow-ups", () => {
    atUtcHour(3);
    expect(shopLocalHour("Not/AZone")).toBe(12);
  });
});

describe("isWithinShopDaytime", () => {
  it("is open across the daytime window and closed outside it", () => {
    atUtcHour(DAYTIME_START_HOUR);
    expect(isWithinShopDaytime("UTC")).toBe(true);

    atUtcHour(DAYTIME_END_HOUR - 1);
    expect(isWithinShopDaytime("UTC")).toBe(true);

    atUtcHour(DAYTIME_END_HOUR); // 21:00 is already closed
    expect(isWithinShopDaytime("UTC")).toBe(false);

    atUtcHour(DAYTIME_START_HOUR - 1); // 07:00 is still closed
    expect(isWithinShopDaytime("UTC")).toBe(false);
  });
});

describe("hoursUntilShopDaytime", () => {
  it("returns 0 inside the window", () => {
    atUtcHour(12);
    expect(hoursUntilShopDaytime("UTC")).toBe(0);
  });

  it("waits until later the same morning when it is early", () => {
    atUtcHour(3);
    expect(hoursUntilShopDaytime("UTC")).toBe(5); // 03:00 -> 08:00
  });

  it("rolls over to the next morning in the evening", () => {
    atUtcHour(22);
    expect(hoursUntilShopDaytime("UTC")).toBe(10); // 22:00 -> 08:00

    atUtcHour(DAYTIME_END_HOUR);
    expect(hoursUntilShopDaytime("UTC")).toBe(11); // 21:00 -> 08:00
  });

  it("lands inside the window from every hour of the day", () => {
    for (let h = 0; h < 24; h++) {
      atUtcHour(h);
      const landing = (h + hoursUntilShopDaytime("UTC")) % 24;
      expect(landing).toBeGreaterThanOrEqual(DAYTIME_START_HOUR);
      expect(landing).toBeLessThan(DAYTIME_END_HOUR);
    }
  });

  it("uses the shop's zone, not the server's", () => {
    atUtcHour(2); // 02:00 UTC — outside the window in UTC...
    expect(hoursUntilShopDaytime("UTC")).toBe(6);
    expect(hoursUntilShopDaytime("Asia/Manila")).toBe(0); // ...but 10:00 in Manila
  });
});
