# Bug: Tapping a Booking Shows "Booking Not Found" Intermittently

## Status: Open
## Priority: High
## Date: 2026-04-07
## Category: Bug - Booking Detail
## Affected: Customer and Shop booking detail (mobile only)

---

## Overview

When tapping a booking from the Bookings list, the detail screen sometimes shows "Booking Not Found — The booking you're looking for doesn't exist or has been removed." even though the booking exists and is visible in the list. This happens intermittently.

---

## Root Cause

The booking detail screen does NOT fetch the booking by ID. Instead, it fetches the **entire bookings list** and searches for the booking in the cached array using `.find()`.

**File:** `mobile/feature/booking/hooks/ui/useBookingDetail.ts` lines 24-26, 44-46

```typescript
// Fetches ALL bookings (paginated list, not a single booking)
const shopBookingQuery = useShopBookingQuery(undefined, { enabled: isShopView });
const customerBookingQuery = useCustomerBookingQuery(undefined, { enabled: !isShopView });
const { data: bookings } = isShopView ? shopBookingQuery : customerBookingQuery;

// Tries to find the specific booking in the cached list
const booking = useMemo(() => {
  if (!bookings || !id) return null;
  return bookings.find((b) => b.orderId === id);  // ← Returns undefined if not in list
}, [bookings, id]);
```

**File:** `mobile/feature/booking/screens/BookingDetailScreen.tsx` line 89:
```typescript
if (error || !booking) {
  // Shows "Booking Not Found"
}
```

### Why it fails intermittently:

1. **Paginated list** — The bookings list API returns a limited set. If the tapped booking is beyond the loaded page, `.find()` returns `undefined`
2. **Stale cache** — If the list query hasn't refetched recently (staleTime: 30s for shop, 5min for customer), newly created bookings aren't in the cached data
3. **Filter mismatch** — The list query is called with `undefined` filters, but the list view may have been loaded with specific filters. The cached data from a filtered query may not include all bookings
4. **Race condition** — If the detail screen renders before the list query completes, `bookings` is `undefined` → `booking` is `null` → "Not Found"

---

## Fix Required

Fetch the individual booking by ID instead of searching the cached list. The API endpoint and service method already exist.

### Option A: Use `getOrderById` (recommended)

**`booking.services.ts`** already has:
```typescript
async getOrderById(orderId: string) {
  return await apiClient.get(`/services/orders/${orderId}`);
}
```

Change `useBookingDetail.ts` to fetch the booking directly:

```typescript
// Replace list-based lookup with direct fetch
const { data: booking, isLoading, error } = useQuery({
  queryKey: ['booking', 'detail', id],
  queryFn: async () => {
    const response = await bookingApi.getOrderById(id);
    return response.data;
  },
  enabled: !!id,
});
```

### Option B: Fallback fetch (if list-based lookup is preferred for performance)

Keep the list lookup but add a fallback fetch when `.find()` returns undefined:

```typescript
const bookingFromList = bookings?.find((b) => b.orderId === id) || null;

// Fallback: fetch by ID if not found in cached list
const { data: bookingById } = useQuery({
  queryKey: ['booking', 'detail', id],
  queryFn: () => bookingApi.getOrderById(id),
  enabled: !!id && !bookingFromList,
});

const booking = bookingFromList || bookingById?.data || null;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/hooks/ui/useBookingDetail.ts:24-46` | Fetch booking by ID instead of searching cached list |

---

## QA Test Plan

### Before fix (reproduce)
1. Open Bookings tab → see a list of bookings
2. Tap any booking
3. **Intermittent**: "Booking Not Found" appears
4. Go back → tap again → may work (cache refreshed)

### After fix
1. Tap any booking from the list
2. **Expected**: Always shows booking detail (fetched by ID)
3. Tap a booking immediately after creation (before cache updates)
4. **Expected**: Still shows correctly (direct API fetch, not cache-dependent)
5. Test on both customer and shop views
