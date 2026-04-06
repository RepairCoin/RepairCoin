# Bug: Booking Details Shows Wrong ID Format, Time, and Raw Category

## Status: Open
## Priority: Medium
## Date: 2026-04-06
## Category: Bug - Booking Details
## Affected: Customer & Shop booking detail screen (mobile only)

---

## Overview

The mobile Booking Details screen has 3 data display issues compared to the web app:
1. Booking ID uses wrong format (first 6 chars instead of last 6)
2. Time shows wrong value (uses `bookingDate` instead of `bookingTimeSlot`)
3. Category shows raw DB value instead of human-readable label

---

## Bug 1: Booking ID Wrong Format

**Mobile shows:** `BK-ORD_09` (first 6 chars of orderId)
**Web shows:** `BK-E1657A` (last 6 chars, dashes removed)

**Root cause:** `BookingDetailScreen.tsx` line 202:
```typescript
value={`BK-${booking.orderId.slice(0, 6).toUpperCase()}`}
```

Uses `.slice(0, 6)` which takes the prefix `ord_xx` — always starts with `ORD_`.

**Correct format** per `frontend/src/utils/formatters.ts` lines 9-13:
```typescript
const shortId = orderId.replace(/-/g, '').slice(-6).toUpperCase();
return `BK-${shortId}`;
```

**Fix:** Change line 202 to:
```typescript
value={`BK-${booking.orderId.replace(/-/g, '').slice(-6).toUpperCase()}`}
```

**File:** `mobile/feature/booking/screens/BookingDetailScreen.tsx:202`

---

## Bug 2: Time Shows Wrong Value

**Mobile shows:** `8:00 AM` (from bookingDate field — date only, no time)
**Web shows:** `3:40 PM` (from bookingTimeSlot — the actual appointment time)

**Root cause:** `useBookingDetail.ts` line 77:
```typescript
const bookingDateTime = booking?.bookingDate || booking?.createdAt || "";
```

`bookingDate` is a date-only field (e.g., `2026-04-07`). When parsed as a Date, JavaScript defaults the time to `00:00 UTC` which becomes `8:00 AM` in the local timezone (UTC+8). The actual appointment time is stored in `bookingTimeSlot` (e.g., `2026-04-07T15:40:00`).

**Fix:** Change line 77 to:
```typescript
const bookingDateTime = booking?.bookingTimeSlot || booking?.bookingDate || booking?.createdAt || "";
```

If `bookingTimeSlot` is not in the BookingData interface, add it:
```typescript
bookingTimeSlot?: string | null;
```

**Note:** This same issue exists in `EnhancedBookingCard.tsx` lines 182 and 194 where booking cards also use `booking.bookingDate` for date/time display.

**Files:**
- `mobile/feature/booking/hooks/ui/useBookingDetail.ts:77`
- `mobile/shared/interfaces/booking.interfaces.ts` — add `bookingTimeSlot` field
- `mobile/feature/booking/components/EnhancedBookingCard.tsx:182,194` — same issue

---

## Bug 3: Category Shows Raw DB Value

**Mobile shows:** `home_cleaning_services`
**Should show:** `Home & Cleaning Services`

**Root cause:** `BookingDetailScreen.tsx` lines 133-136:
```typescript
{booking.serviceCategory && (
  <Text className="text-gray-500 text-sm mt-1">
    {booking.serviceCategory}
  </Text>
)}
```

Displays the raw DB value directly without mapping to a label.

**The utility already exists:** `mobile/shared/utilities/getCategoryLabel.ts`:
```typescript
export const getCategoryLabel = (category?: string): string => {
  if (!category) return "Other";
  const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
  return cat?.label || category;
};
```

**Fix:** Import and use `getCategoryLabel`:
```typescript
{booking.serviceCategory && (
  <Text className="text-gray-500 text-sm mt-1">
    {getCategoryLabel(booking.serviceCategory)}
  </Text>
)}
```

**File:** `mobile/feature/booking/screens/BookingDetailScreen.tsx:133-136`

---

## Summary

| Issue | Field | Mobile (Wrong) | Web (Correct) | File:Line |
|---|---|---|---|---|
| Booking ID | `orderId` | `BK-ORD_09` (.slice(0,6)) | `BK-E1657A` (.slice(-6)) | BookingDetailScreen.tsx:202 |
| Time | `bookingDate` | `8:00 AM` (date parsed as midnight) | `3:40 PM` (from bookingTimeSlot) | useBookingDetail.ts:77 |
| Category | `serviceCategory` | `home_cleaning_services` | `Home & Cleaning Services` | BookingDetailScreen.tsx:135 |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/screens/BookingDetailScreen.tsx:202` | Fix booking ID: `.replace(/-/g, '').slice(-6)` |
| `mobile/feature/booking/screens/BookingDetailScreen.tsx:135` | Use `getCategoryLabel(booking.serviceCategory)` |
| `mobile/feature/booking/hooks/ui/useBookingDetail.ts:77` | Use `bookingTimeSlot` instead of `bookingDate` |
| `mobile/shared/interfaces/booking.interfaces.ts` | Add `bookingTimeSlot?: string \| null` |
| `mobile/feature/booking/components/EnhancedBookingCard.tsx:182,194` | Use `bookingTimeSlot` for date/time display |

---

## QA Test Plan

### Bug 1: Booking ID
1. Open a booking detail on mobile
2. Note the Booking ID
3. Open the same booking on web
4. **Verify**: Both show the same ID format (e.g., `BK-E1657A`)

### Bug 2: Time
1. Book a service at a specific time (e.g., 3:40 PM)
2. Open the booking detail on mobile
3. **Before fix**: Shows wrong time (e.g., 8:00 AM)
4. **After fix**: Shows correct time (3:40 PM)
5. Compare with web — should match exactly

### Bug 3: Category
1. Open a booking for a service with category `home_cleaning_services`
2. **Before fix**: Shows `home_cleaning_services`
3. **After fix**: Shows `Home & Cleaning Services`
4. Test other categories: `automotive_repair`, `electronics_repair`, etc.
