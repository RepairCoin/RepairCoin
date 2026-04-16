# Bug: Shop calendar dots hidden when a status filter is active

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

On the shop Bookings and Appointments tabs, selecting any status filter (e.g. "completed", "paid") also filtered the dots shown on the calendar. Users saw the full legend of status colors but only dots for the selected status, making it look like other bookings vanished.

**Example — April 16 (peanut shop):**
- With filter = "completed", calendar shows only 2 green dots.
- Actual data has 2 completed + 2 paid (should show 4 dots total).

## Analysis

### Root cause

`mobile/feature/booking/hooks/ui/useBookingsData.ts` — `getBookingsForDate` returned dates from the **already-filtered** `filteredBookings` array. Consumers of that function used it for both:

1. The calendar-dot renderers (short strip + full calendar modal) — should show **all** statuses
2. The selected-date booking list below the calendar — should respect the filter

Since one function served both purposes, calendar dots were incorrectly pruned whenever a filter was active.

## Implementation

### Files modified

- `mobile/feature/booking/hooks/ui/useBookingsData.ts`
  - Extracted `isSameDay` helper to de-duplicate the date-match logic.
  - Kept `getBookingsForDate` (filter-aware, used by the list).
  - Added `getAllBookingsForDate` that always returns matches from `bookingsData` (unfiltered), used by calendar dots.

- `mobile/feature/booking/components/BookingShopTab.tsx`
  - Destructured `getAllBookingsForDate` from `useBookingsData`.
  - `BookingCalendarProps` extended with `getAllBookingsForDate`.
  - Short-strip dots (line 108) and full-calendar-modal dots (line 377) switched to `getAllBookingsForDate`.
  - `selectedBookings` still uses `getBookingsForDate` so the list under the calendar respects the filter.

- `mobile/feature/appointment/components/AppointmentShopTab.tsx`
  - Same pattern: added `getAllAppointmentsForDate` alias over `getAllBookingsForDate`.
  - `AppointmentCalendarProps` extended accordingly.
  - Short-strip dots and full-calendar-modal dots switched to the unfiltered getter.
  - `selectedAppointments` list still respects the filter.

### Approach

Minimal change inside the shared hook + targeted swap at the two dot render sites in each tab. Did not touch unrelated calendar logic (month navigation, year picker, full-calendar grid layout).

## Verification Checklist

- [x] Full calendar shows ALL booking dots regardless of filter selection
- [x] Short calendar shows ALL booking dots regardless of filter selection
- [x] Filter chips only affect the booking list below the calendar
- [x] Legend colors match the dots displayed (all statuses always shown)
- [x] Switching filters does not change calendar dots — only the list changes

## Notes

- **Behavior match:** Calendar dots now match the short-strip and web calendar behavior for the same date.
- **Test data:** Verify on a date with mixed-status bookings (e.g. April 16 for shop "peanut" which has completed + paid orders).
- **Regression check:** The selected-date booking count under the calendar still reflects the filter ("showing X bookings" should match the list). The dots above may outnumber it — that's the intended behavior.
