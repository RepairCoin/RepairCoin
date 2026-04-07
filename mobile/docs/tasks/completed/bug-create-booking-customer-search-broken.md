# Bug: Create Booking Customer Search Always Shows "No Customers Found"

**Status:** Completed
**Priority:** High
**Est. Effort:** 1 hr
**Created:** 2026-04-07
**Updated:** 2026-04-07
**Completed:** 2026-04-07

## Overview

The "Create Booking" screen's customer search always shows "No customers found" regardless of the search input. The search fails due to two bugs: a response field access error and a field name mismatch between backend and mobile interface.

**Affected:** Shop "Create Booking" customer search (mobile only)

---

## Bug 1: Response Structure Mismatch (Primary Cause)

**File:** `mobile/shared/services/appointment.services.ts` line 401

```typescript
async searchCustomers(shopId: string, query: string): Promise<CustomerSearchResult[]> {
  const response = await apiClient.get(`/services/shops/${shopId}/customers/search?q=${query}`);
  return response.data || [];  // ❌ response.data is undefined
}
```

The `apiClient.get()` method (in `axios.ts` line 253-254) already unwraps `response.data`, so `response` here is the JSON body:

```json
{ "success": true, "customers": [...] }
```

`response.data` is `undefined` → falls back to `[]` → always returns empty array.

**Fix:** Change line 401 to:

```typescript
return response.customers || [];
```

---

## Bug 2: Field Name Mismatch

Backend returns (`ManualBookingController.ts` lines 489-497):

```
{ address, email, name, phone, noShowCount, noShowTier, createdAt }
```

Mobile expects (`CustomerSearchResult` interface, lines 60-67):

```
{ customerAddress, customerName, customerEmail, customerPhone, totalBookings, lastVisit }
```

Even after fixing Bug 1, the mobile would try to read `item.customerAddress` which is `undefined` because the backend sends `item.address`.

**Fix:** Either update the interface and rendering to use backend field names, or map the response:

```typescript
return (response.customers || []).map((c: any) => ({
  customerAddress: c.address,
  customerName: c.name,
  customerEmail: c.email,
  customerPhone: c.phone,
  totalBookings: 0,
  lastVisit: c.createdAt,
}));
```

---

## How Web Gets It Right

**`frontend/src/services/api/appointments.ts`** lines 384-390:

```typescript
const response = await apiClient.get('/services/shops/...');
return response.customers;  // ✅ Correct field access
```

The web interface also uses `address`, `name`, `email`, `phone` (matching backend) — no `customer` prefix.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/services/appointment.services.ts` | Fix response field access and map field names |
| `mobile/shared/interfaces/appointment.interface.ts` | Optionally update `CustomerSearchResult` interface |

---

## QA Test Plan

### Before fix

1. Login as shop on mobile
2. Go to Bookings → Create Booking
3. Type a customer name or wallet address
4. **Result:** Always "No customers found"

### After fix

1. Search by customer name → matching customers appear
2. Search by wallet address → matching customer appears
3. Tap a result → fields auto-populate (wallet, name, email, phone)
4. Search with < 2 characters → no search triggered (debounce)
5. Search for non-existent customer → "No customers found" (correct)

---

## Notes

The backend only returns customers who have previously booked at this shop. New customers without order history won't appear in search — they must be entered manually. This is by design.
