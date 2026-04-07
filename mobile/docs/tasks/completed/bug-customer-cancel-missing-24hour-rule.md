# Bug: Mobile Customer Cancel Missing 24-Hour Advance Rule

## Status: Open
## Priority: High
## Date: 2026-04-06
## Category: Bug - Booking Cancellation Policy
## Affected: Customer booking cancellation (mobile + backend)

---

## Overview

The mobile app allows customers to cancel bookings at any time regardless of how close the appointment is. The web app correctly hides the cancel button when the appointment is less than 24 hours away. However, the 24-hour rule is only enforced client-side on the web — the backend `/orders/{id}/cancel` endpoint does not enforce it, so even if the mobile added the UI check, a direct API call could bypass it.

---

## Current Behavior

| Platform | Cancel button visible < 24hrs? | 24-hour rule enforced? | Where? |
|---|---|---|---|
| **Web** | No — hidden | Yes | Client-side only (`AppointmentsTab.tsx:162-169`) |
| **Mobile** | Yes — always shown for "paid" | No | Not checked anywhere |
| **Backend `/orders/{id}/cancel`** | N/A | No | No time check in `PaymentService.cancelOrder()` |
| **Backend `/appointments/cancel/{id}`** | N/A | Yes | `AppointmentRepository.ts:553-562` |

---

## Evidence

Same booking (April 7, 2026, 3:40 PM) viewed on April 6 evening:
- **Web**: Only "Reschedule" button shown, no cancel (< 24 hours away)
- **Mobile**: Both "Request Reschedule" and "Cancel Booking" buttons shown

---

## Root Cause

### Mobile — No 24-hour check

**`mobile/feature/booking/components/BookingActions.tsx`** lines 74-87:

```typescript
export function CustomerActions({ status, ... onCancel, ... }) {
  if (status === "paid") {
    return (
      <View className="gap-2">
        <ActionButton label="Request Reschedule" ... />
        <ActionButton label="Cancel Booking" ... onPress={onCancel} />
      </View>
    );
  }
  // ...
}
```

Cancel button renders for **any** booking with `status === "paid"` — no time check.

### Web — Client-side only enforcement

**`frontend/src/components/customer/AppointmentsTab.tsx`** lines 162-169:

```typescript
const canCancelAppointment = (appointment: CalendarBooking): boolean => {
  const appointmentDate = new Date(year, month - 1, day);
  const now = new Date();
  const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntil >= 24 && status !== 'completed' && status !== 'cancelled';
};
```

Hides the cancel button when < 24 hours. But this is UI-only — the API would still accept the cancel.

### Backend — Two endpoints, inconsistent enforcement

| Endpoint | 24-hour check | Used by |
|---|---|---|
| `POST /orders/{id}/cancel` | **No** | Web customer cancel, Mobile customer cancel |
| `POST /appointments/cancel/{id}` | **Yes** (line 559) | Not used by web or mobile for cancel |

The endpoint both apps actually use (`/orders/{id}/cancel` in `PaymentService.cancelOrder()`) only checks for `completed` or `cancelled` status — no time-based restriction.

---

## Fix Required (Two Parts)

### Part 1: Mobile UI — Add 24-hour check (matches web)

In `BookingActions.tsx`, the `CustomerActions` component should check if the appointment is 24+ hours away before showing cancel:

```typescript
export function CustomerActions({ status, isApproved, bookingDate, bookingTimeSlot, ... }) {
  const canCancel = useMemo(() => {
    if (!bookingDate) return true;
    const appointmentDate = new Date(`${bookingDate}T${bookingTimeSlot || '00:00'}`);
    const hoursUntil = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil >= 24;
  }, [bookingDate, bookingTimeSlot]);

  if (status === "paid") {
    return (
      <View className="gap-2">
        <ActionButton label="Request Reschedule" ... />
        {canCancel && (
          <ActionButton label="Cancel Booking" ... onPress={onCancel} />
        )}
      </View>
    );
  }
}
```

Props `bookingDate` and `bookingTimeSlot` need to be passed from `BookingDetailScreen`.

### Part 2: Backend — Add 24-hour check to `/orders/{id}/cancel` (defense in depth)

In `PaymentService.cancelOrder()` (lines 839-856), add the same 24-hour check that exists in `AppointmentRepository.cancelAppointment()`:

```typescript
// After checking status !== 'completed' and status !== 'cancelled'
if (order.bookingDate && order.bookingTimeSlot) {
  const bookingDateTime = new Date(`${order.bookingDate}T${order.bookingTimeSlot}`);
  const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 24) {
    throw new Error('Bookings must be cancelled at least 24 hours in advance');
  }
}
```

This ensures the 24-hour rule is enforced even if the UI check is bypassed.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/components/BookingActions.tsx:74-87` | Add 24-hour check before showing cancel button |
| `mobile/feature/booking/screens/BookingDetailScreen.tsx` | Pass `bookingDate` and `bookingTimeSlot` to `CustomerActions` |
| `backend/src/domains/ServiceDomain/services/PaymentService.ts:839-856` | Add 24-hour check in `cancelOrder()` |

---

## QA Test Plan

### Mobile (before fix)
1. Book a service for tomorrow
2. Wait until < 24 hours before the appointment
3. Open booking detail → Cancel button is visible
4. **Bug**: Customer can cancel with less than 24 hours notice

### Mobile (after fix)
1. Booking > 24 hours away → Cancel button visible
2. Booking < 24 hours away → Cancel button hidden, only Reschedule shown
3. Booking completed → No cancel button
4. Booking already cancelled → No cancel button

### Backend (after fix)
1. Try calling `POST /orders/{id}/cancel` directly for a booking < 24 hours away
2. **Expected**: 400 error "Bookings must be cancelled at least 24 hours in advance"
3. Try for a booking > 24 hours away → should succeed

### Web (regression)
1. Verify web cancel behavior unchanged — button hidden < 24 hours, visible >= 24 hours
