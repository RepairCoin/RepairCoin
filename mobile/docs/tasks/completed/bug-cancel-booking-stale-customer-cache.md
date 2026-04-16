# Bug: Cancel button stays visible after booking is cancelled

**Status:** Completed
**Priority:** High
**Est. Effort:** 15 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

After a customer successfully cancelled a booking:

1. Success toast appeared ("Booking has been cancelled.") ✓
2. **Cancel button remained visible on the booking detail screen** ✗
3. Tapping cancel again triggered the backend error "This booking is already cancelled."

The UI did not reflect the cancelled status because the **customer** booking cache was never invalidated — only shop-side caches were.

## Analysis

### Root cause

`mobile/feature/booking/hooks/mutations/useBookingMutations.ts`:

- `useCancelOrderMutation` (customer cancel) invalidated only `["repaircoin", "bookings", "shop"]`, `["repaircoin", "appointments"]`, and `["shopBookings"]`. The customer's own booking list/detail key `["repaircoin", "bookings", "customer"]` (`queryKeys.customerBookings` in `shared/config/queryClient.ts:112`) was missing.
- `useCancelOrderByShopMutation` (shop cancel) had the same gap — cancelling on the shop side did not propagate to the customer's cached view.

Because React Query invalidates by prefix match, invalidating `["repaircoin", "bookings", "customer"]` covers all filter/page variations under that namespace. The existing `useRescheduleActions.ts` already invalidates this key for reschedule operations, so the cancel path was simply omitted.

## Implementation

### Files modified

- `mobile/feature/booking/hooks/mutations/useBookingMutations.ts`
  - `useCancelOrderMutation.onSuccess`: added `queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] })`.
  - `useCancelOrderByShopMutation.onSuccess`: added the same invalidation so a shop-initiated cancel also refreshes the customer's view.

### Approach

Minimal, targeted fix — one additional invalidation line in each of the two `onSuccess` handlers. No navigation changes, no refactor.

## Verification Checklist

- [x] Customer cancels booking → cancel button disappears after refetch completes
- [x] Booking status updates to "Cancelled" on detail screen
- [x] Back to bookings list shows updated status
- [x] Shop cancels a booking → customer's view also reflects the cancellation
- [x] No "already cancelled" error when user stays on screen and tries to interact again

## Notes

- **Test:** Customer opens a paid/pending booking → tap Cancel → confirm. Detail screen should switch to "Cancelled" state and hide the Cancel button. Navigating back shows the cancelled status in the list.
- **Regression check:** Reschedule flow already invalidates `bookings.customer` (see `useRescheduleActions.ts`) — behavior there is unchanged.
- **Not in scope:** The bug report suggested an optional `router.back()` on cancel. Skipped to keep UX changes minimal; the button-hide + status-update behavior is sufficient to unblock the bug.
