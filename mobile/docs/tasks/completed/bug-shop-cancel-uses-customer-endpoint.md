# Bug: Mobile Shop Cancel Uses Customer Cancel Endpoint

## Status: Fixed

## Priority: High

## Date: 2026-04-06

## Category: Bug - Booking Cancellation

## Affected: Shop booking cancellation (mobile only)

---

## Overview

When a shop cancels a booking from the mobile app, it calls the customer cancel endpoint (`POST /orders/{id}/cancel`) instead of the shop-specific endpoint (`POST /orders/{id}/shop-cancel`). This means shop cancellations may not trigger the correct full-refund logic and are not tracked as shop-initiated.

---

## Root Cause

The mobile `useCancelOrderMutation` hook uses a single `cancelOrder` API call for both customer and shop, without differentiating based on the caller's role.

**`mobile/feature/booking/hooks/mutations/useBookingMutations.ts`** — cancel mutation calls:

```typescript
bookingApi.cancelOrder(orderId); // Always uses customer endpoint
```

**`mobile/shared/services/booking.services.ts`** — API method:

```typescript
// POST /services/orders/{orderId}/cancel  (customer endpoint)
```

There is no `cancelOrderByShop()` method in the mobile API service.

---

## How It Should Work

| Caller       | Endpoint                                     | Refund Logic                                              |
| ------------ | -------------------------------------------- | --------------------------------------------------------- |
| **Customer** | `POST /api/services/orders/{id}/cancel`      | Selective — RCN refund if redeemed, Stripe refund if paid |
| **Shop**     | `POST /api/services/orders/{id}/shop-cancel` | Full automatic refund — both RCN and Stripe               |

### Backend Differences

**Customer cancel** (`OrderController.ts` lines 478-537):

- Verifies `order.customerAddress === req.user.address`
- Selective refund logic

**Shop cancel** (`OrderController.ts` lines 740-818):

- Verifies `order.shopId === req.user.shopId`
- Calls `processShopCancellationRefund()` — full refund (RCN + Stripe)
- Shop cancellations tracked separately for analytics

### Web Does It Correctly

- Customer cancel: `servicesApi.cancelOrder(orderId, reason)` → `POST /orders/{id}/cancel`
- Shop cancel: `servicesApi.cancelOrderByShop(orderId, reason)` → `POST /orders/{id}/shop-cancel`

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

| File                                                            | Change                                          |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `mobile/shared/services/booking.services.ts`                    | Add `cancelOrderByShop(orderId, reason)` method |
| `mobile/feature/booking/hooks/mutations/useBookingMutations.ts` | Add `useCancelOrderByShopMutation` hook         |
| `mobile/feature/booking/hooks/ui/useBookingDetail.ts`           | Use correct mutation based on `isShopView`      |

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
2. Verify backend logs show `/orders/{id}/shop-cancel` (shop endpoint)
3. Verify full refund is processed (both RCN + Stripe)
4. Login as customer on mobile → cancel a booking
5. Verify it still uses `/orders/{id}/cancel` (customer endpoint)
6. Compare refund behavior with web — should be identical
