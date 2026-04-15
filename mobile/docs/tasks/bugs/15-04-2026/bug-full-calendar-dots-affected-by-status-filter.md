# Bug: Full Calendar Dots Filtered by Status — Missing Bookings

## Status: Open
## Priority: Medium
## Date: 2026-04-15
## Category: Bug - UI / Calendar
## Platform: Mobile (React Native / Expo)
## Affects: Shop > Appointments tab > Full Calendar view

---

## Problem

The full calendar (MonthlyCalendarView) applies the active status filter to the calendar dots. When a filter like "completed" is selected, only completed bookings show as dots on the calendar — other statuses disappear. But the legend at the bottom still shows all statuses (pending, paid, in progress, completed, cancelled, no show), which is misleading.

**Example — April 16 (peanut shop):**

| Booking | Status | Short Calendar | Full Calendar | Web |
|---|---|---|---|---|
| 9:00AM | paid (approved) | Blue dot | Missing | Shows |
| 12:00PM | completed | Green dot | Green dot | Shows |
| 3:00PM | paid (approved) | Blue dot | Missing | Shows |
| 4:30PM | completed | Green dot | Green dot | Shows |

The short calendar shows 3 dots (2 green + 1 blue). The full calendar shows only 2 green dots — the paid/blue bookings are hidden because the filter excludes them.

---

## Root Cause

**File:** `mobile/feature/appointment/components/AppointmentShopTab.tsx` (line 472)

```typescript
const { isLoading, getBookingsForDate: getAppointmentsForDate } = useBookingsData(statusFilter);
```

`useBookingsData(statusFilter)` filters bookings by status before returning them. The `getBookingsForDate` function then only returns filtered bookings for each date. So the calendar dots only show bookings matching the active filter.

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts` (lines 20-32)

```typescript
const filteredBookings = useMemo(() => {
  if (statusFilter === "all") return bookingsData;
  return bookingsData.filter((booking) => booking.status === statusFilter);
}, [bookingsData, statusFilter]);

const getBookingsForDate = (date: Date): BookingData[] => {
  return filteredBookings.filter(/* date match */);  // Uses filtered data
};
```

---

## Expected Behavior

The **calendar dots should always show ALL bookings** regardless of the active filter. The filter should only affect the **booking list below the calendar**. This matches the web calendar behavior.

The legend shows all status colors — the dots should reflect all statuses too.

---

## Fix Required

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts`

Add a separate unfiltered getter for calendar dots:

```typescript
// For calendar dots — always show ALL bookings
const getAllBookingsForDate = (date: Date): BookingData[] => {
  return bookingsData.filter((booking) => {
    const bookingDate = booking.bookingDate
      ? new Date(booking.bookingDate)
      : new Date(booking.createdAt);
    return (
      bookingDate.getFullYear() === date.getFullYear() &&
      bookingDate.getMonth() === date.getMonth() &&
      bookingDate.getDate() === date.getDate()
    );
  });
};

// For booking list — filtered by status
const getFilteredBookingsForDate = (date: Date): BookingData[] => {
  return filteredBookings.filter(/* date match */);
};

return {
  bookings: filteredBookings,
  getAllBookingsForDate,      // Calendar dots use this
  getBookingsForDate: getFilteredBookingsForDate,  // Booking list uses this
};
```

**File:** `mobile/feature/appointment/components/AppointmentShopTab.tsx`

Use `getAllBookingsForDate` for the calendar, keep filtered data for the list:

```typescript
const { isLoading, getAllBookingsForDate, getBookingsForDate } = useBookingsData(statusFilter);

// Pass unfiltered to calendar
<AppointmentCalendar getAppointmentsForDate={getAllBookingsForDate} />

// Pass filtered to booking list
<BookingList bookings={getBookingsForDate(selectedDate)} />
```

Apply the same fix to the short calendar in `BookingShopTab.tsx`.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/hooks/ui/useBookingsData.ts` | Add `getAllBookingsForDate` that ignores status filter |
| `mobile/feature/appointment/components/AppointmentShopTab.tsx` | Use `getAllBookingsForDate` for calendar dots |
| `mobile/feature/booking/components/BookingShopTab.tsx` | Use `getAllBookingsForDate` for calendar dots |

---

## QA Verification

- [ ] Full calendar shows ALL booking dots regardless of filter selection
- [ ] Short calendar shows ALL booking dots regardless of filter selection
- [ ] Filter chips only affect the booking list below the calendar
- [ ] Legend colors match the dots displayed
- [ ] April 16 (peanut) shows 4 dots: 2 green (completed) + 2 blue (paid)
- [ ] Switching filters doesn't change calendar dots — only list changes
- [ ] Web and mobile calendars show same dots for same date
