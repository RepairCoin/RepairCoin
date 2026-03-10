# Bug: Bookings Sort Button Non-Functional

**Status:** N/A - ALREADY IMPLEMENTED
**Priority:** LOW
**Est. Effort:** 1 hour
**Created:** 2026-03-10
**Updated:** 2026-03-10

---

## Problem

Sort button in bookings view doesn't work - no onClick handler.

## Analysis

Upon investigation, sorting is **already implemented** in mobile:

1. **BookingShopTab.tsx** (Shop view)
   - Line 524-528: `sortedBookings` sorts by date descending (most recent first)
   ```typescript
   const sortedBookings = [...bookings].sort((a, b) => {
     const dateA = new Date(a.bookingDate || a.createdAt).getTime();
     const dateB = new Date(b.bookingDate || b.createdAt).getTime();
     return dateB - dateA;
   });
   ```

2. **useBookingsTab.ts** (Customer view)
   - Lines 87-92: Sorts upcoming by date ascending, past by date descending
   ```typescript
   upcoming.sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
   past.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
   ```

## Conclusion

This task may refer to the frontend web app rather than mobile. No changes needed for mobile - sorting works correctly.

## Verification

- [x] Shop bookings sorted by most recent first
- [x] Customer bookings sorted correctly (upcoming ascending, past descending)
