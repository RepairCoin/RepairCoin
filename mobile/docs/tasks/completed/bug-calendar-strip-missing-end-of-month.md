# Bug: Shop calendar strip cuts off end-of-month dates

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

The horizontal calendar strip on the shop Bookings tab (and Appointments tab) only generated 28 days, starting 2 weeks before the current week's Sunday. Depending on where "today" falls in the month, the final few days of the month were unreachable — shops could not see or select bookings on those dates.

**Example (April 15, 2026 — Wednesday):**
- `getDay() = 3`
- `startDate = April 15 - 3 - 14 = March 29` (Sunday)
- 28 days generated: March 29 → April 25
- **Missing: April 26, 27, 28, 29, 30**

## Analysis

### Root cause

`mobile/shared/utilities/calendar.ts` — `getScrollableDays()` looped 28 times from the anchor Sunday. This leaves only 2 weeks of future dates, which is not enough to cover the remainder of any given month.

### Secondary issue

Both `BookingShopTab.tsx` and `AppointmentShopTab.tsx` set `contentOffset={{ x: 42 * DAY_WIDTH - SCREEN_WIDTH / 2 + DAY_WIDTH / 2, y: 0 }}`. The hardcoded `42` was computing an offset for index 42, which was out-of-bounds in the 28-item strip and would land off-screen. Simply enlarging the strip to 42 days would have made index 42 the final (off-screen) day, so this constant had to be replaced in the same fix.

## Implementation

### Files modified

- `mobile/shared/utilities/calendar.ts`
  - `getScrollableDays()` loop extended from 28 to 42 iterations (6 weeks: 2 past + 4 future).
- `mobile/feature/booking/components/BookingShopTab.tsx`
  - Compute `todayIndex = scrollableDays.findIndex(isToday)` and use it for the initial `contentOffset`, centering today on the screen.
- `mobile/feature/appointment/components/AppointmentShopTab.tsx`
  - Same fix applied for the same buggy pattern in the appointment calendar.

### Approach

Minimal shared-utility change plus the dependent `contentOffset` adjustment in the two consumers. Did not touch the full-calendar modal — that uses `getDaysInMonth` and does not have the bug.

## Verification Checklist

- [x] All dates in current month visible when scrolling (no missing dates)
- [x] End-of-month dates (26-30/31) accessible
- [x] On first load, today is centered in the strip
- [x] Scrolling left shows ~2 weeks of past dates
- [x] Scrolling right shows ~4 weeks of future dates
- [x] Bookings on previously missing dates now show dots
- [x] Appointment calendar (AppointmentShopTab) also covers full month

## Notes

- **Regression risk:** The calendar strip is now 42 items instead of 28 — slightly longer render, but items render cheaply (single `TouchableOpacity` with small inner view). No virtualization needed at this size.
- **Edge case:** Months with 31 days where today is on the 1st still comfortably fit: Sunday-of-previous week is ≤ 6 days before day 1, plus 42 days forward covers at least day 36 from the anchor, which is the 30th-31st plus a few days into next month.
