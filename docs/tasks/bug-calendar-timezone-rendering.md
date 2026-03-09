# BUG: Calendar Grid Shows Wrong Day for Users in Western Timezones (UTC-*)

**Status:** Fixed (pending deployment)
**Priority:** High
**Type:** Bug (UI / Timezone)
**Reported:** 2026-03-09
**Related:** Appointment scheduling system

## Description

The shop appointment calendar grid displays bookings on the **wrong day** for users in timezones west of UTC (e.g., US Eastern UTC-5, US Pacific UTC-8). Bookings appear shifted one day earlier on the calendar grid, while the sidebar "Upcoming" section shows the correct date.

## Evidence

Tester in US timezone:
- Sidebar shows: **"Wed, Mar 18 (2)"** with two bookings (Gold 6 Month Plan at 10:15 AM, Hand Wraps at 11:30 AM)
- Calendar grid: **March 18 cell is empty**, bookings appear on March 17 cell instead
- User in PH timezone (UTC+8) sees calendar rendering correctly

Database confirms:
- `booking_date` = `2026-03-18 00:00:00` (timestamp without time zone)
- Shop: RepairCoin (shop_id: `1111`)
- Customer: Mike (`0xe3e20bfa5a7edadb92fc89801bb756697b3c5640`)

## Root Cause

JavaScript's `new Date("YYYY-MM-DD")` parses date-only strings as **UTC midnight** (per ISO 8601 spec), but `getDate()`, `getMonth()`, `getFullYear()` return values in **local timezone**.

For a US EST (UTC-5) user:
```
new Date("2026-03-18")           → 2026-03-18T00:00:00.000Z (UTC midnight)
.getDate()                        → 17 (March 17 at 7:00 PM local)
```

This caused the calendar grid to label cells with the wrong day number, making it appear that bookings were on the previous day.

### Affected Code Paths

1. **`AppointmentsTab.tsx` line 761** — `new Date(day.date).getDate()` for calendar day number display
2. **`AppointmentsTab.tsx` line 251** — `isCurrentMonth()` using `new Date(dateStr).getMonth()`
3. **`AppointmentsTab.tsx` line 1109** — Payment link modal date display
4. **`AppointmentCalendar.tsx` line 284** — Same day number display bug
5. **`AppointmentCalendar.tsx` line 177** — Same `isCurrentMonth` bug
6. **`AppointmentCalendar.tsx` line 392** — Booking detail date display
7. **`AppointmentCard.tsx` line 58** — Future/past appointment classification
8. **`BookingCard.tsx` line 66** — Date formatting for display

### Why Sidebar Worked Correctly

The sidebar (upcoming section) used `formatDateLocal()` which produces `"YYYY-MM-DD"` strings, and then created display labels with `new Date(bookingDateOnly + 'T00:00:00')` — appending `T00:00:00` forces local time parsing. The calendar grid did NOT append this suffix.

## Fixes Applied

### Fix 1: Calendar day number — string parsing instead of Date object
```typescript
// BEFORE (UTC parsing bug):
const dayNumber = new Date(day.date).getDate();

// AFTER (direct string extraction):
const dayNumber = parseInt(day.date.split('-')[2], 10);
```
Applied in both `AppointmentsTab.tsx` and `AppointmentCalendar.tsx`.

### Fix 2: isCurrentMonth — string parsing instead of Date object
```typescript
// BEFORE:
const date = new Date(dateStr);
return date.getMonth() === currentDate.getMonth();

// AFTER:
const [year, month] = dateStr.split('-').map(Number);
return (month - 1) === currentDate.getMonth() && year === currentDate.getFullYear();
```
Applied in both `AppointmentsTab.tsx` and `AppointmentCalendar.tsx`.

### Fix 3: Date display strings — append T00:00:00 for local parsing
```typescript
// BEFORE:
new Date(bookingDate).toLocaleDateString()

// AFTER:
new Date(bookingDate + (bookingDate.includes('T') ? '' : 'T00:00:00')).toLocaleDateString()
```
Applied in `AppointmentsTab.tsx` (payment modal) and `AppointmentCalendar.tsx` (booking detail).

### Fix 4: AppointmentCard future check — component constructor parsing
```typescript
// BEFORE:
const appointmentDate = new Date(appointment.bookingDate);

// AFTER:
const bookingParts = appointment.bookingDate.split('-').map(Number);
const appointmentDate = new Date(bookingParts[0], bookingParts[1] - 1, bookingParts[2]);
```

### Fix 5: BookingCard date format — append T00:00:00
```typescript
// BEFORE:
const date = new Date(dateString);

// AFTER:
const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
```

## Files Changed
- `frontend/src/components/shop/tabs/AppointmentsTab.tsx` — 3 fixes (dayNumber, isCurrentMonth, payment modal date)
- `frontend/src/components/shop/AppointmentCalendar.tsx` — 3 fixes (dayNumber, isCurrentMonth, booking detail date)
- `frontend/src/components/customer/AppointmentCard.tsx` — 1 fix (future date check)
- `frontend/src/components/customer/BookingCard.tsx` — 1 fix (date formatting)

## Prevention

The codebase has correct utilities in `frontend/src/utils/appointmentUtils.ts` and `frontend/src/utils/dateUtils.ts` that handle YYYY-MM-DD parsing safely. Future code should use:
```typescript
// Option 1: Split and construct (best)
const [year, month, day] = dateStr.split('-').map(Number);
const date = new Date(year, month - 1, day);

// Option 2: Append local time suffix
const date = new Date(dateStr + 'T00:00:00');

// NEVER do this with YYYY-MM-DD strings:
const date = new Date(dateStr); // Parsed as UTC!
```

## Impact (before fix)
- Calendar grid showed bookings on wrong day for all users west of UTC
- Bookings appeared shifted one day earlier on calendar
- `isFuture` checks could incorrectly classify today's appointments as past
- Month boundary dates could appear in wrong month
- Sidebar and calendar showed inconsistent dates, confusing shop owners
