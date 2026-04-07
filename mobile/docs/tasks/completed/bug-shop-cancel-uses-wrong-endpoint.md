# Bug: Shop Booking Cancellation Uses Customer Endpoint

**Status:** Completed
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-04-06
**Updated:** 2026-04-07
**Completed:** 2026-04-07

## Overview

When a shop cancels a booking from the mobile app, it calls the customer cancel endpoint (`POST /orders/{id}/cancel`) instead of the shop-specific endpoint (`POST /orders/{id}/shop-cancel`). This means shop cancellations may not trigger the correct full-refund logic and are not tracked as shop-initiated.

## Root Cause

The mobile `useCancelOrderMutation` hook uses a single `cancelOrder` API call for both customer and shop, without differentiating based on the caller's role.

**`mobile/feature/booking/hooks/mutations/useBookingMutations.ts`** — cancel mutation calls:

```typescript
bookingApi.cancelOrder(orderId)  // Always uses customer endpoint
```

**`mobile/shared/services/booking.services.ts`** — API method:

```typescript
// POST /services/orders/{orderId}/cancel  (customer endpoint)
```

There is no `cancelOrderByShop()` method in the mobile API service.

## How It Should Work

| Action | Endpoint | Refund Logic |
|--------|----------|-------------|
| Customer cancels | `POST /orders/{id}/cancel` | Selective refund |
| Shop cancels | `POST /orders/{id}/shop-cancel` | Full refund (RCN + Stripe) |

## Backend Differences

**Customer cancel** (`OrderController.ts` lines 478-537):
- Verifies `order.customerAddress === req.user.address`
- Selective refund logic

**Shop cancel** (`OrderController.ts` lines 740-818):
- Verifies `order.shopId === req.user.shopId`
- Calls `processShopCancellationRefund()` — full refund (RCN + Stripe)
- Shop cancellations tracked separately for analytics

## Web Does It Correctly

- **Customer cancel:** `servicesApi.cancelOrder(orderId, reason)` → `POST /orders/{id}/cancel`
- **Shop cancel:** `servicesApi.cancelOrderByShop(orderId, reason)` → `POST /orders/{id}/shop-cancel`

---

## Fix Required

1. **Add shop cancel API method** in `mobile/shared/services/booking.services.ts`:

```typescript
async cancelOrderByShop(orderId: string, reason?: string): Promise<any> {
  return apiClient.post(`/services/orders/${orderId}/shop-cancel`, { reason });
}
```

2. **Add shop cancel mutation** in `mobile/feature/booking/hooks/mutations/useBookingMutations.ts`:

```typescript
export function useCancelOrderByShopMutation() { ... }
```

3. **Use correct mutation based on role** in `mobile/feature/booking/hooks/ui/useBookingDetail.ts`:
   - If `isShopView` → use `useCancelOrderByShopMutation`
   - If customer → use existing `useCancelOrderMutation`

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/services/booking.services.ts` | Add `cancelOrderByShop()` method |
| `mobile/feature/booking/hooks/mutations/useBookingMutations.ts` | Add shop cancel mutation |
| `mobile/feature/booking/hooks/ui/useBookingDetail.ts` | Use correct mutation based on role |

---

## QA Test Plan

### Before Fix (reproduce)

1. Login as shop on mobile
2. Open a paid booking
3. Cancel it
4. Check backend logs — cancel hits `/orders/{id}/cancel` (customer endpoint)
5. Refund may be incomplete (no automatic full refund)

### After Fix (verify)

1. Login as shop on mobile → cancel a paid booking
2. **Verify:** Backend logs show `/orders/{id}/shop-cancel` (shop endpoint)
3. **Verify:** Full refund is processed (both RCN + Stripe)
4. Login as customer on mobile → cancel a booking
5. **Verify:** It still uses `/orders/{id}/cancel` (customer endpoint)
6. Compare refund behavior with web — should be identical
