# Bug: Cancel Button Still Visible After Booking Cancellation — Stale Cache

## Status: Open
## Priority: Medium
## Date: 2026-04-15
## Category: Bug - Booking / Cache Invalidation
## Platform: Mobile (React Native / Expo)
## Affects: Customer booking detail screen after cancellation

---

## Problem

After a customer cancels a booking:
1. Success toast appears: "Booking has been cancelled" (correct)
2. Cancel button remains visible on the booking detail screen (bug)
3. Tapping cancel again shows: "This booking is already cancelled" (backend rejects correctly)

The UI doesn't update to reflect the cancelled status because the customer booking cache is not invalidated.

---

## Root Cause

**File:** `mobile/feature/booking/hooks/mutations/useBookingMutations.ts` (lines 60-63)

```typescript
// useCancelOrderMutation — customer cancel
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });   // ← Shop cache
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "appointments"] });        // ← Appointments
  queryClient.invalidateQueries({ queryKey: ["shopBookings"] });                      // ← Shop bookings
  showSuccess("Booking has been cancelled.");
  // MISSING: queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });
},
```

The customer bookings query key is `["repaircoin", "bookings", "customer"]` (defined in `queryClient.ts` line 112), but the cancel mutation only invalidates shop-related keys. The customer's booking detail screen reads from the stale customer cache.

The shop cancel mutation (`useCancelOrderByShopMutation` lines 83-84) has the same issue — it doesn't invalidate the customer cache either.

---

## Fix Required

**File:** `mobile/feature/booking/hooks/mutations/useBookingMutations.ts`

Add customer booking cache invalidation to both cancel mutations:

### Customer cancel (useCancelOrderMutation, line 60):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });  // ← Add this
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "appointments"] });
  queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
  showSuccess("Booking has been cancelled.");
},
```

### Shop cancel (useCancelOrderByShopMutation, line 82):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "shop"] });
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings", "customer"] });  // ← Add this
  queryClient.invalidateQueries({ queryKey: ["shopBookings"] });
  showSuccess("Booking cancelled. Full refund will be processed.");
},
```

### Optional: Navigate back after cancel

After cancellation, consider navigating back to the bookings list instead of staying on the detail screen:

```typescript
onSuccess: () => {
  // ... invalidate caches
  showSuccess("Booking has been cancelled.");
  router.back();  // Return to bookings list
},
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/hooks/mutations/useBookingMutations.ts` | Add `["repaircoin", "bookings", "customer"]` invalidation to both cancel mutations |

---

## QA Verification

- [ ] Customer cancels booking → cancel button disappears immediately
- [ ] Booking status updates to "Cancelled" on detail screen
- [ ] Tapping back shows updated status in bookings list
- [ ] Shop cancels a booking → customer's view also updates
- [ ] No "already cancelled" error on second interaction
