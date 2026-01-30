# Shop RCN Earned Display Fix

## Status: ✅ COMPLETED

**Date Completed:** January 16, 2026

---

## Problem Statement

The shop bookings view was displaying **"RCN Earned: +0 RCN"** for completed orders, even though customers actually earned RCN tokens. The customer view correctly showed the earned amount (e.g., "+25.00 RCN").

### Example
- **Booking ID:** BK-A11C8F
- **Shop View:** RCN Earned: +0 RCN ❌
- **Customer View:** You earned +25.00 RCN ✓

---

## Root Cause

The `getOrdersByShop` method in `OrderRepository.ts` was **missing the JOIN with the transactions table** to fetch the `rcn_earned` value.

### Before (Broken)
```sql
SELECT
  o.*,
  s.service_name,
  ...
  c.name as customer_name
FROM service_orders o
INNER JOIN shop_services s ON o.service_id = s.service_id
LEFT JOIN customers c ON o.customer_address = c.address
-- Missing: LEFT JOIN transactions t ...
```

### After (Fixed)
```sql
SELECT
  o.*,
  s.service_name,
  ...
  c.name as customer_name,
  COALESCE(t.amount, 0) as rcn_earned
FROM service_orders o
INNER JOIN shop_services s ON o.service_id = s.service_id
LEFT JOIN customers c ON o.customer_address = c.address
LEFT JOIN transactions t ON t.metadata->>'orderId' = o.order_id AND t.type = 'mint'
```

---

## Why Customer View Worked

The `getOrdersByCustomer` method already had the correct JOIN:

```sql
COALESCE(t.amount, 0) as rcn_earned,
...
LEFT JOIN transactions t ON t.metadata->>'orderId' = o.order_id AND t.type = 'mint'
```

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/repositories/OrderRepository.ts` | Added `rcn_earned` field and transactions JOIN to `getOrdersByShop` query (lines 362-379) |

---

## Verification

1. Database query confirmed RCN earned is stored correctly:
   ```
   Order ID: ord_31f376d4-a9a1-40f8-8262-bd8c9ea11c8f
   RCN Earned: 25.00
   Metadata: { orderId: "ord_31f376d4-a9a1-40f8-8262-bd8c9ea11c8f", ... }
   ```

2. After fix, shop view should display correct RCN earned value

---

## Testing Steps

1. Restart backend server: `cd backend && npm run dev`
2. Log in as shop owner
3. Navigate to Shop > Bookings
4. Click on a completed booking
5. Verify "RCN Earned" shows the correct value (not 0)

---

## Related Components

- **Frontend:** `frontend/src/components/shop/bookings/tabs/BookingOverviewTab.tsx` (displays `booking.rcnEarned`)
- **API Type:** `ServiceOrderWithDetails.rcnEarned` in `frontend/src/services/api/services.ts`
- **Backend:** `OrderRepository.mapOrderWithDetailsRow()` maps `rcn_earned` to `rcnEarned`

---

*Created: January 16, 2026*
*Status: ✅ COMPLETED*
