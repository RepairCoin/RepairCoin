# Bug: Booking Calendar and List Show No Data Despite Bookings Existing

**Status:** open
**Priority:** critical
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

The shop's Service > Booking tab shows no bookings in both Calendar and List views, while the web Appointments page shows many bookings for the same shop (e.g., Shop Peanut: 1 Confirmed, 2 Completed, 10 Cancelled, 8 No Show). The mobile uses a wrong API endpoint with a 20-record pagination limit, while the web uses a dedicated calendar endpoint with no pagination.

---

## Root Cause: Wrong API Endpoint + Pagination Limit

The mobile and web use **completely different endpoints** to fetch booking data:

| | Mobile | Web |
|---|---|---|
| **Endpoint** | `GET /services/orders/shop` | `GET /services/appointments/calendar` |
| **Pagination** | Yes — default **limit 20** | **No pagination** — returns all |
| **Date filter** | None sent — fetches all time | `startDate` + `endDate` params |
| **Sorting** | `ORDER BY created_at DESC` | `ORDER BY booking_date, booking_time_slot` |
| **Filter condition** | None on `booking_date` | `WHERE booking_date IS NOT NULL AND booking_date BETWEEN $2 AND $3` |

### Why this causes empty results:

1. Mobile calls `/services/orders/shop` with **no filters** (`useBookingsData.ts:7`)
2. Backend returns **only the first 20 orders** sorted by `created_at DESC` (`OrderController.ts:208`: `limit: 20`)
3. Mobile receives 20 recent orders
4. `getBookingsForDate()` filters client-side by matching `bookingDate` to the selected calendar date
5. If the 20 returned orders don't have `bookingDate` matching the currently viewed week/date, **zero bookings appear**
6. Orders without `bookingDate` (older orders created before the scheduling feature) also pollute the 20-record window

For Shop Peanut with 21+ total orders, the first 20 returned may be old orders that either:
- Have `bookingDate` outside the current calendar view (March 2026)
- Have `bookingDate = null` (pre-scheduling orders)

The remaining orders with March 2026 dates are on page 2+ and **never fetched**.

---

## Code Evidence

### Mobile — fetches with no filters, gets paginated 20

**`useBookingsData.ts:7`** — No filters passed:
```typescript
const { data: bookingsData, isLoading, error, refetch } = useShopBookingQuery();
// No filters = no date range, no status, no pagination params
```

**`OrderController.ts:206-209`** — Backend defaults to 20:
```typescript
const options = {
  page: parseInt(req.query.page as string) || 1,
  limit: parseInt(req.query.limit as string) || 20  // only 20 records
};
```

### Web — uses dedicated calendar endpoint with date range

**`AppointmentsTab.tsx:138`** — Passes date range:
```typescript
const bookings = await appointmentsApi.getShopCalendar(startDate, endDate);
```

**`AppointmentRepository.ts:417-460`** — No pagination, date-filtered:
```sql
SELECT ... FROM service_orders o
JOIN shop_services s ON o.service_id = s.service_id
WHERE o.shop_id = $1
  AND o.booking_date IS NOT NULL
  AND o.booking_date >= $2::date
  AND o.booking_date <= $3::date
ORDER BY o.booking_date, o.booking_time_slot
-- NO LIMIT clause
```

### Mobile already has the correct API method (unused!)

**`mobile/shared/services/appointment.services.ts:156-170`**:
```typescript
async getShopCalendar(startDate: string, endDate: string): Promise<CalendarBooking[]> {
  const queryString = buildQueryString({ startDate, endDate });
  const response = await apiClient.get(
    `/services/appointments/calendar${queryString}`
  );
  return response.data || [];
}
```

This method exists but is **never called** by the `BookingShopTab`.

---

## Fix

### Option A: Use the calendar endpoint for Calendar view (Recommended)

Switch the Calendar view to use `appointmentApi.getShopCalendar()` — the same endpoint the web uses. The method already exists in the mobile codebase.

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts`

```typescript
import { appointmentApi } from "@/feature/appointment/services/appointment.services";

export function useBookingsData(statusFilter: BookingFilterStatus) {
  // For calendar: use the dedicated calendar endpoint with date range
  const { data: calendarData, isLoading: calendarLoading, refetch: refetchCalendar } = useQuery({
    queryKey: ['shopCalendar', startDate, endDate],
    queryFn: () => appointmentApi.getShopCalendar(startDate, endDate),
    staleTime: 30 * 1000,
  });

  // For list: use orders endpoint with higher limit
  const { data: bookingsData, isLoading, refetch } = useShopBookingQuery({
    limit: 200,
  });
  ...
}
```

### Option B: Increase pagination limit (Quick fix)

Pass a larger limit to the orders endpoint:

**File:** `mobile/feature/booking/hooks/ui/useBookingsData.ts`

```typescript
const { data: bookingsData, isLoading, error, refetch } = useShopBookingQuery({
  limit: 500,  // fetch enough to cover all bookings
});
```

This is simpler but wastes bandwidth fetching orders without booking dates.

### Option C: Pass date range to orders endpoint (Moderate fix)

Add date range parameters to the existing orders query:

```typescript
const { data: bookingsData } = useShopBookingQuery({
  startDate: firstDayOfMonth.toISOString(),
  endDate: lastDayOfMonth.toISOString(),
  limit: 200,
});
```

---

## Impact on Both Views

This bug affects **both** Calendar and List views:

- **Calendar view**: `getBookingsForDate()` iterates the 20-record subset → mostly no matches for the current week
- **List view**: `filteredBookings` operates on the 20-record subset → may show some bookings, but incomplete data. Combined with the status filter bug (Pending/Paid always empty), the List view appears mostly broken too.

---

## Files to Modify

1. `mobile/feature/booking/hooks/ui/useBookingsData.ts` — Switch to calendar endpoint or increase limit
2. `mobile/feature/booking/components/BookingShopTab.tsx` — May need to pass date range context
3. `mobile/shared/interfaces/booking.interfaces.ts` — Add `limit` to `BookingFilters` if not present

---

## Reproduction Steps

1. Login as Shop Peanut on web — navigate to Appointments tab
2. Observe: Calendar shows multiple bookings across March 2026
3. Login as Shop Peanut on mobile app
4. Navigate to Service > Booking tab > Calendar view
5. Observe: "No bookings for this day" on every date
6. Switch to List view > "All" filter
7. Observe: May show some bookings, but far fewer than web shows

---

## Existing Mobile API (Ready to Use)

The fix is straightforward because `appointmentApi.getShopCalendar(startDate, endDate)` already exists at `mobile/shared/services/appointment.services.ts:156-170`. It calls the same `/services/appointments/calendar` endpoint that the web uses successfully. The BookingShopTab just needs to be wired to use it.
