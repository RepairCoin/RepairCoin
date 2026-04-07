# Bug: New Booking Not Listed in Bookings Tab Until Manual Refresh

## Status: Open
## Priority: High
## Date: 2026-04-07
## Category: Bug - Cache Invalidation
## Affected: Customer bookings tab after payment (mobile only)

---

## Overview

After a customer completes a Stripe payment for a service booking and returns to the app, the new booking does not appear in the Bookings tab. The customer must manually pull-to-refresh or restart the app to see it. The issue is a query key mismatch — the payment success screen invalidates the wrong cache key.

---

## Root Cause

### Payment success invalidates wrong key

**File:** `mobile/app/(dashboard)/shared/payment-sucess/index.tsx` line 109:
```typescript
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings"] });
```

### Bookings tab uses a different key

**File:** `mobile/shared/config/queryClient.ts` lines 122, 131-132:
```typescript
appointments: () => [...queryKeys.all, 'appointments'] as const,
myAppointments: (startDate, endDate) => [...queryKeys.appointments(), 'my', startDate, endDate] as const,
// Resolves to: ['repaircoin', 'appointments', 'my', startDate, endDate]
```

**File:** `mobile/shared/hooks/booking/useBooking.ts` line 49:
```typescript
queryKey: queryKeys.myAppointments(startDate, endDate),
// Uses: ['repaircoin', 'appointments', 'my', '2026-03-07', '2026-07-05']
```

### The mismatch

| Source | Key | Matches? |
|---|---|---|
| Payment success invalidates | `["repaircoin", "bookings"]` | - |
| Bookings tab query uses | `["repaircoin", "appointments", "my", ...]` | No |

`"bookings"` does not match `"appointments"` — the cache invalidation misses the bookings tab entirely. The data stays stale until the 2-minute `staleTime` expires or the user manually refreshes.

---

## Fix Required

**File:** `mobile/app/(dashboard)/shared/payment-sucess/index.tsx` line 109

Change:
```typescript
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings"] });
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
```

To:
```typescript
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings"] });
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "appointments"] });
await queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
```

Adding `["repaircoin", "appointments"]` will invalidate all appointment-related queries including `myAppointments`, which is what the bookings tab uses.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/app/(dashboard)/shared/payment-sucess/index.tsx:109` | Add `["repaircoin", "appointments"]` to invalidation |

---

## QA Test Plan

### Before fix
1. Login as customer on mobile
2. Book a service and complete Stripe payment
3. Return to app → go to Bookings tab
4. **Bug**: New booking is not listed
5. Pull to refresh → booking appears

### After fix
1. Book a service and complete Stripe payment
2. Return to app → go to Bookings tab
3. **Expected**: New booking appears immediately without manual refresh
