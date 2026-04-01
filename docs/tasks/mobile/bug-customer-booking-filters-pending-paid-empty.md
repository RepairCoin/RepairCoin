# Bug: Customer Bookings Tab — "Pending" and "Paid" Status Filters Return No Data

**Status:** open
**Priority:** medium
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)
**Related:** `docs/tasks/mobile/bug-booking-pending-paid-filters-always-empty.md` (shop-side equivalent)

---

## Summary

On the customer's Services > Bookings tab, selecting "Pending" or "Paid" from the Status dropdown returns no results. This is **related to but different from** the shop-side booking filter bug.

---

## Root Cause Analysis

### "Pending" filter — Same root cause as shop bug (no orders with this status)

**File:** `mobile/feature/service/hooks/ui/useBookingsTab.ts` (lines 111-114)

```typescript
if (activeStatus !== "all") {
  filtered = filtered.filter(
    (apt) => apt.status.toLowerCase() === activeStatus
  );
}
```

The filter checks `apt.status === "pending"`, but no order is ever created with status `"pending"`. Orders are created with `status: 'paid'` after payment succeeds (`PaymentService.ts:601`). This is the **same root cause** as the shop-side bug — the "pending" status exists in the type definition but is never used in the order creation flow.

**Result:** "Pending" filter always returns 0 results.

### "Paid" filter — Different from shop bug, but still problematic

Unlike the shop-side bug (which added a `!shopApproved` condition making "Paid" impossible), the customer-side filter does a **simple equality check**: `apt.status === "paid"`.

This means "Paid" **can** technically return results if there are orders currently in "paid" status. However, in practice it often shows empty because:

1. Orders are created as `status: "paid"` but quickly transition to `"completed"` when the shop marks them done, or to `"cancelled"`/`"no_show"`/`"expired"`
2. The customer endpoint (`getCustomerAppointments`) filters by date range (30 days past to 90 days future) — older paid orders fall outside the window
3. For Shop Peanut's customer, the screenshot shows only "Completed" and "No_show" statuses — no orders remain in "paid" state

**Result:** "Paid" filter returns 0 for this customer because all their bookings have already transitioned past "paid" status.

---

## Additional Issue: Missing Status Filters

**File:** `mobile/feature/service/constants/CUSTOMER_SERVICE_TABS.ts` (lines 12-19)

Current STATUS_FILTERS:
```typescript
export const STATUS_FILTERS = [
  { key: "all", label: "All Status", color: "#FFCC00" },
  { key: "pending", label: "Pending", color: "#EAB308" },     // never matches
  { key: "paid", label: "Paid", color: "#3B82F6" },           // rarely matches
  { key: "approved", label: "Approved", color: "#10B981" },   // not a real DB status
  { key: "completed", label: "Completed", color: "#22C55E" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
];
```

**Missing statuses that DO exist in the database:**
- `no_show` — visible in screenshot but not in filter dropdown
- `expired` — valid backend status, no filter option
- `refunded` — valid backend status, no filter option

**Phantom statuses in the filter:**
- `pending` — never used by order creation
- `approved` — not a real database status (it's `paid` + `shopApproved` flag)

---

## How This Relates to the Shop-Side Bug

| Aspect | Shop Bug | Customer Bug |
|---|---|---|
| **Task doc** | `bug-booking-pending-paid-filters-always-empty.md` | This doc |
| **"Pending" filter** | Same — status never exists | Same — status never exists |
| **"Paid" filter** | Broken by `&& !shopApproved` condition | Simple equality — works but rarely matches |
| **Data source** | `/services/orders/shop` (paginated 20) | `/services/appointments/my-appointments` (date-ranged) |
| **Filter location** | `booking/hooks/ui/useBookingsData.ts` | `service/hooks/ui/useBookingsTab.ts` |
| **Filter constants** | `booking/constants/BOOKING_STATUS_FILTERS.ts` | `service/constants/CUSTOMER_SERVICE_TABS.ts` |

**Shared root cause:** The order lifecycle doesn't include a "pending" state, and the "approved" concept is a flag on "paid" orders, not a separate status.

---

## Fix

### Fix 1: Remove/replace unusable status filters

**File:** `mobile/feature/service/constants/CUSTOMER_SERVICE_TABS.ts`

```typescript
export const STATUS_FILTERS: FilterOption[] = [
  { key: "all", label: "All Status", color: "#FFCC00" },
  { key: "paid", label: "Paid", color: "#3B82F6" },
  { key: "completed", label: "Completed", color: "#22C55E" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
  { key: "no_show", label: "No Show", color: "#F97316" },
  { key: "expired", label: "Expired", color: "#6B7280" },
];
```

Changes:
- Remove `pending` (never used)
- Remove `approved` (not a real DB status)
- Add `no_show` (exists in DB, visible in screenshot)
- Add `expired` (exists in DB)

### Fix 2: Update filter logic for "approved" if keeping it

If the business wants an "Approved" filter, check `shopApproved` field (needs to be added to `MyAppointment` interface):

```typescript
if (activeStatus === "approved") {
  filtered = filtered.filter(
    (apt) => apt.status.toLowerCase() === "paid" && apt.shopApproved === true
  );
}
```

---

## Files to Modify

1. `mobile/feature/service/constants/CUSTOMER_SERVICE_TABS.ts` — Update STATUS_FILTERS to match real DB statuses
2. `mobile/feature/service/hooks/ui/useBookingsTab.ts` — Update filter logic if adding compound filters
3. `mobile/feature/service/tab-types.ts` — Update `BookingStatusFilter` type to include `no_show`, `expired`

---

## Reproduction Steps

1. Login as a customer on the mobile app
2. Navigate to Services > Bookings tab
3. Tap the Status dropdown filter
4. Select "Pending" — shows no bookings
5. Select "Paid" — shows no bookings (if all orders have transitioned)
6. Select "All Status" — bookings appear (Completed, No Show visible)
7. Note: "No Show" bookings visible under "All" but no "No Show" filter option exists
