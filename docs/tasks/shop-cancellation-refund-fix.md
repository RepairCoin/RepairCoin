# Shop Cancellation Refund Fix

## Status: DONE

## Summary
Fixed critical bug where shop-initiated cancellations were not processing Stripe refunds due to invalid refund reason parameter.

## Problem
When a shop cancelled a booking, the system was:
- ✅ Updating order status to "cancelled"
- ✅ Refunding RCN tokens (if any)
- ❌ NOT processing Stripe refunds

**Root Cause:** The code was passing `'requested_by_merchant'` as the Stripe refund reason, but Stripe only accepts:
- `duplicate`
- `fraudulent`
- `requested_by_customer`

## Solution
Changed the refund reason from `'requested_by_merchant'` to `'requested_by_customer'` in `PaymentService.ts`.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | Fixed refund reason parameter (line 918) |

## Code Change

```typescript
// Before (BROKEN)
await this.stripeService.refundPayment(
  paymentIntentId,
  'requested_by_merchant'
);

// After (FIXED)
await this.stripeService.refundPayment(
  paymentIntentId,
  'requested_by_customer'  // Stripe only accepts: duplicate, fraudulent, requested_by_customer
);
```

## Testing

### Automated Test Script
Created `backend/scripts/automated-shop-cancel-test.ts` that:
1. Finds a paid order in database
2. Generates shop JWT token
3. Calls POST `/api/services/orders/:id/shop-cancel`
4. Verifies refund appears in Stripe

### Verification Result
```
✅ REFUND SUCCESSFUL!
   Refund ID: re_3Spk30L8hwPnzzXk0Dd5xOu8
   Amount: $59
   Status: succeeded
```

## Backfill Results
Processed refunds for previously cancelled orders that were missed:

| Metric | Count |
|--------|-------|
| Total cancelled orders | 41 |
| Already refunded | 3 |
| Newly refunded | 15 |
| Failed (no charge) | 23 |

**Total amount refunded:** ~$2,437

## Test Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/automated-shop-cancel-test.ts` | E2E API test for shop cancel |
| `scripts/verify-refund-fix.ts` | Direct Stripe API verification |
| `scripts/backfill-missing-refunds.ts` | Backfill missed refunds |
| `scripts/find-unrefunded-order.ts` | Find orders needing refunds |

## How to Test Manually

1. Start backend server: `cd backend && npm run dev`
2. Log in as a shop owner
3. Go to Bookings tab (`/shop?tab=bookings`)
4. Click "Cancel" on a paid booking
5. Select reason and confirm
6. Check Stripe dashboard for refund

## API Endpoint

```
POST /api/services/orders/:orderId/shop-cancel

Headers:
  Authorization: Bearer <shop_jwt_token>

Body:
{
  "cancellationReason": "shop_closed" | "scheduling_conflict" | "service_unavailable" | "other",
  "cancellationNotes": "Optional notes"
}

Response:
{
  "success": true,
  "message": "Booking cancelled and refund processed",
  "data": {
    "orderId": "ord_xxx",
    "rcnRefunded": 100,
    "stripeRefunded": 59.00,
    "refundStatus": "100 RCN refunded, $59.00 refunded to card"
  }
}
```

## Acceptance Criteria

- [x] Shop can cancel paid bookings
- [x] RCN tokens are refunded to customer
- [x] Stripe payment is refunded to customer
- [x] Customer receives notification about cancellation
- [x] Order status updated to "cancelled"
- [x] Cancellation reason and notes stored in database
- [x] Refund appears in Stripe dashboard

## Related Files

- `backend/src/domains/ServiceDomain/services/PaymentService.ts` - `processShopCancellationRefund()`
- `backend/src/domains/ServiceDomain/controllers/OrderController.ts` - `cancelOrderByShop()`
- `backend/src/services/StripeService.ts` - `refundPayment()`
- `frontend/src/components/shop/CancelBookingModal.tsx` - UI component

## Date Completed
January 15, 2026
