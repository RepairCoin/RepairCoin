# Bug: Short Calendar Missing End-of-Month Dates

## Status: Open
## Priority: Medium
## Date: 2026-04-15
## Category: Bug - UI / Calendar
## Platform: Mobile (React Native / Expo)
## Affects: Shop > Booking tab > Calendar view (short calendar strip)

---

## Problem

The short calendar strip only generates 28 days (4 weeks), starting from 2 weeks before the current week's Sunday. This cuts off the last few days of the month. Shops cannot see or access bookings on the missing dates.

**Example (April 15, 2026 — Wednesday):**
- `getDay()` = 3 (Wednesday)
- `startDate` = April 15 - 3 - 14 = **March 29** (Sunday)
- 28 days generated: March 29 → April 25
- **Missing: April 26, 27, 28, 29, 30**

Scrolling left/right only reveals dates within the 28-day window. The last 5 days of April don't exist in the strip.

---

## Root Cause

**File:** `mobile/shared/utilities/calendar.ts` (lines 36-52)

```typescript
export function getScrollableDays(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  const currentDay = today.getDay();

  // Start from 2 weeks ago (Sunday of that week)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDay - 14);

  // Generate 28 days (4 weeks)
  for (let i = 0; i < 28; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
}
```

The loop runs 28 times — only 2 weeks before and 2 weeks after the start of the current week. Late-month dates are excluded.

---

## Fix Required

**File:** `mobile/shared/utilities/calendar.ts`

Increase the range to 6 weeks (42 days) — 2 weeks before and 4 weeks after:

```typescript
export function getScrollableDays(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  const currentDay = today.getDay();

  // Start from 2 weeks ago (Sunday of that week)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDay - 14);

  // Generate 42 days (6 weeks) to cover full month + buffer
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
}
```

Also update the `contentOffset` in `BookingShopTab.tsx` (line 99) to center on today's index:

```typescript
// Today is roughly at index 14 (2 weeks into the array)
const todayIndex = scrollableDays.findIndex(d => isToday(d));
const offset = Math.max(0, todayIndex * DAY_WIDTH - SCREEN_WIDTH / 2 + DAY_WIDTH / 2);

<ScrollView contentOffset={{ x: offset, y: 0 }}>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/utilities/calendar.ts` | Increase loop from 28 to 42 days |
| `mobile/feature/booking/components/BookingShopTab.tsx` | Fix `contentOffset` to dynamically center on today |
| `mobile/feature/appointment/components/AppointmentShopTab.tsx` | Same `contentOffset` fix if applicable |

---

## QA Verification

- [ ] All dates in current month visible when scrolling (no missing dates)
- [ ] End-of-month dates (26-30/31) accessible
- [ ] On first load, today is centered in the strip
- [ ] Scrolling left shows 2 weeks of past dates
- [ ] Scrolling right shows 4 weeks of future dates
- [ ] Bookings on previously missing dates now show dots
