# Bug: Calendar dots hard-capped at 2-3 per day — hides bookings and misrepresents day activity

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 1 hour
**Created:** 2026-04-20
**Updated:** 2026-04-21
**Completed:** 2026-04-21

---

## Problem

The shop-side calendar (both full-month and short-strip views) hard-capped the number of dots rendered under each day at 2 (full calendar) or 3 (short strip), regardless of how many bookings existed. This caused duplicate status dots and hid booking statuses beyond the cap.

## Root Cause

Per-booking rendering with a hard `.slice()` cap: `dayBookings.slice(0, 2).map(b => ...)` in the full calendar and `dayBookings.slice(0, 3)` in the short strip. This truncated bookings rather than summarising status information.

## Fix

Replaced per-booking dot rendering with **one dot per distinct status**, ordered by attention priority, capped at 3.

### Changes

| File                                                    | Change                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `shared/utilities/calendar.ts`                          | Added `getDistinctStatusesForDots(bookings, max)` helper with priority ordering                   |
| `feature/booking/components/BookingShopTab.tsx`         | Replaced `slice(0, 2)` and `slice(0, 3)` with `getDistinctStatusesForDots` in both calendar views |
| `feature/appointment/components/AppointmentShopTab.tsx` | Same changes as BookingShopTab                                                                    |

### Priority Order

`no_show > cancelled > expired > pending > in_progress > paid > completed` — attention-requiring statuses surface first.

## Verification

- Day with 4 bookings of 2 statuses shows 2 distinct-status dots (not 4 or 2 same-color)
- Day with all-same-status bookings shows 1 dot
- Day with 4+ distinct statuses shows 3 dots, prioritising attention-requiring statuses
- Empty days unchanged; selected-day dot hiding unchanged
- Filter-separation fix (commit `85a52c5f`) unaffected — dots still show all statuses regardless of filter
