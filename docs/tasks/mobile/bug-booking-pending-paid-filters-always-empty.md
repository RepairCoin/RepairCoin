# Bug: Booking Tab "Pending" and "Paid" Filters Always Show Empty

**Status:** open
**Priority:** high
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

On the shop's Service > Booking tab (List view), the "Pending" and "Paid" status filters always show "No bookings found", even when bookings exist and appear under "All", "Approved", or "Completed" filters.

---

## Root Cause: Status Lifecycle Mismatch

The filter logic assumes a booking lifecycle that doesn't match the actual backend behavior.

### What the mobile filter expects:

```
pending → paid (not approved) → approved (paid + shopApproved) → completed
```

### What actually happens in the backend:

```
paid + shopApproved=true (created simultaneously) → completed
```

**There is no "pending" state and no "paid but not approved" state.**

---

## Bug 1: "Pending" Filter — Status Never Exists

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts` (line 28-29)

```typescript
return bookingsData.filter(
  (booking: BookingData) => booking.status === statusFilter  // statusFilter = "pending"
);
```

The filter checks for `booking.status === "pending"`, but no order is ever created with status `"pending"`.

**Backend evidence** — `PaymentService.ts:601`:
```typescript
const order = await this.orderRepository.createOrder({
  ...
  status: 'paid',           // always 'paid', never 'pending'
  shopApproved: true,        // auto-approved immediately
  approvedAt: new Date()
});
```

**Backend evidence** — `OrderRepository.ts:99`:
```typescript
const status = params.status || 'paid';  // Default to 'paid' - orders are created after payment succeeds
```

Orders are only created **after** payment succeeds, so they start as `"paid"` — the `"pending"` status is defined in the type union but never used in the order creation flow.

**Result:** `"pending"` filter matches 0 bookings.

---

## Bug 2: "Paid" Filter — shopApproved Is Always True

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts` (lines 22-26)

```typescript
if (statusFilter === "paid") {
  return bookingsData.filter(
    (booking: BookingData) => booking.status === "paid" && !booking.shopApproved
  );
}
```

The filter requires `status === "paid" AND shopApproved === false`. But the backend auto-approves orders on creation:

**Backend evidence** — `PaymentService.ts:601-603`:
```typescript
status: 'paid',
shopApproved: true,       // <-- always true at creation
approvedAt: new Date()    // <-- always set at creation
```

Every order with `status === "paid"` also has `shopApproved === true`, so the `!booking.shopApproved` condition is always false.

**Result:** `"paid"` filter matches 0 bookings.

---

## Why "Approved" Works

The "Approved" filter (line 15-18) checks for `status === "paid" && shopApproved === true`:

```typescript
if (statusFilter === "approved") {
  return bookingsData.filter(
    (booking: BookingData) => booking.status === "paid" && booking.shopApproved === true
  );
}
```

Since ALL paid orders are auto-approved, this matches every paid booking. This is why "Approved" shows data but "Paid" doesn't — they're looking at opposite sides of the same condition.

---

## Fix Options

### Option A: Remove unused filters (Simplest)

Remove "Pending" and "Paid" from the filter list since these states don't exist in the current business flow:

**File:** `mobile/feature/booking/constants/BOOKING_STATUS_FILTERS.ts`

```typescript
export const BOOKING_STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];
```

### Option B: Implement a real pending/approval workflow (Larger change)

If the intent is for shops to manually approve bookings before they're confirmed:

1. Backend: Create orders with `shopApproved: false` initially
2. Backend: Add an approval step before marking as approved
3. Mobile: "Pending" = `status === "paid" && !shopApproved` (awaiting shop approval)
4. Mobile: "Approved" = `status === "paid" && shopApproved === true`

This requires changing `PaymentService.ts:603` from `shopApproved: true` to `shopApproved: false`.

### Option C: Rename filters to match actual lifecycle (Compromise)

Rename "Approved" to "Paid" (since all paid orders are auto-approved) and remove the "Pending" filter:

```typescript
export const BOOKING_STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Paid", value: "approved" },      // renamed, same logic
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];
```

---

## All Order Statuses vs Mobile Filters

| Backend Status | shopApproved | Mobile Filter | Shows Data? | Why |
|---|---|---|---|---|
| `paid` | `true` | "Approved" | Yes | All paid orders are auto-approved |
| `paid` | `false` | "Paid" | **No** | Never happens — auto-approved on creation |
| `pending` | any | "Pending" | **No** | Never created — orders start as `paid` |
| `completed` | any | "Completed" | Yes | Orders transition to completed |
| `cancelled` | any | "Cancelled" | Yes | Orders can be cancelled |
| `expired` | any | "Expired" | Yes | Orders can expire |
| `no_show` | any | *(none)* | N/A | Not in mobile filters |
| `refunded` | any | *(none)* | N/A | Not in mobile filters |

---

## Files Involved

1. `mobile/feature/booking/hooks/ui/useBookingsData.ts` — Client-side filter logic (lines 10-31)
2. `mobile/feature/booking/constants/BOOKING_STATUS_FILTERS.ts` — Filter definitions
3. `backend/src/domains/ServiceDomain/services/PaymentService.ts` — Order creation (line 601-603)
4. `backend/src/repositories/OrderRepository.ts` — Default status logic (line 99)

---

## Reproduction Steps

1. Login as a shop owner on the mobile app
2. Navigate to Service > Booking tab > List view
3. Tap "Pending" filter — shows "No bookings found"
4. Tap "Paid" filter — shows "No bookings found"
5. Tap "All" or "Approved" — bookings appear correctly
