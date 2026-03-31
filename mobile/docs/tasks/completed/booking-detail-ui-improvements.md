# Bug: Booking Detail Screen UI Improvements

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

The shop/customer card header on the booking detail screen only showed "SHOP" or "CUSTOMER" — lacked context for the user.

## Implementation

- File: `feature/booking/screens/BookingDetailScreen.tsx`
- Changed "Customer" → "Customer Information" and "Shop" → "Shop Information"

## Verification Checklist

- [x] Shop header shows "SHOP INFORMATION" (customer view)
- [x] Customer header shows "CUSTOMER INFORMATION" (shop view)
- [x] No visual regression on other booking detail sections
