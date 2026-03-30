# Bug: Paid Bookings Count Shows Incorrect Number

**Status**: Open
**Priority**: Medium
**Date**: 2026-03-16
**Reported by**: Deo (shop ID: peanut)

## Description

The "Paid" stat card on the Shop Bookings page shows "1" when there are actually 4 paid bookings visible in the list. The stat card count does not match the Paid tab filter count.

## Root Cause

Inconsistent status filtering across components:

- **BookingStatsCards.tsx (line 13)** - WRONG: only counts `status === 'paid'`
- **BookingFilters.tsx (line 31)** - CORRECT: counts `'paid' || 'approved' || 'scheduled'`
- **BookingsTabV2.tsx (line 114)** - CORRECT: filters `'paid' || 'approved' || 'scheduled'`

The stat card uses a narrower filter than the tab and list, causing the mismatch.

## Files to Fix

- `frontend/src/components/shop/bookings/BookingStatsCards.tsx` (line 13)

## Fix

Change line 13 in BookingStatsCards.tsx from:

```ts
const paidCount = bookings.filter(b => b.status === 'paid').length;
```

To:

```ts
const paidCount = bookings.filter(b => b.status === 'paid' || b.status === 'approved' || b.status === 'scheduled').length;
```

Note: The `totalRevenue` calculation on line 14-16 of the same file already correctly includes all three statuses.

## Additional Context

- Backend API returns correct data — issue is frontend only
- The `pendingCount` on line 11 also includes `'paid'` status which may need review
