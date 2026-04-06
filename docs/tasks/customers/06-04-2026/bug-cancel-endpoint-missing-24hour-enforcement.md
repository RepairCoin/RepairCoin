# Bug: Cancel Order Endpoint Missing 24-Hour Enforcement

## Status: Open
## Priority: High
## Date: 2026-04-06
## Category: Bug - Backend Security / Business Logic
## Location: `POST /api/services/orders/{id}/cancel`

---

## Overview

The customer cancel endpoint (`POST /orders/{id}/cancel`) does not enforce the 24-hour advance cancellation policy. The rule is only enforced client-side on the web UI and on a separate unused endpoint (`/appointments/cancel/{id}`). A customer could bypass the web UI and call the API directly to cancel a booking minutes before the appointment.

---

## Current State

| Layer | 24-Hour Rule? | Location |
|---|---|---|
| Web UI | Yes (hides button) | `AppointmentsTab.tsx:162-169` |
| Mobile UI | No | `BookingActions.tsx:74-87` (separate task) |
| **`POST /orders/{id}/cancel`** | **No** | `PaymentService.cancelOrder():839-856` |
| `POST /appointments/cancel/{id}` | Yes | `AppointmentRepository.ts:553-562` (unused by web/mobile) |

---

## Root Cause

**`backend/src/domains/ServiceDomain/services/PaymentService.ts`** lines 839-856:

```typescript
async cancelOrder(orderId, cancellationReason, cancellationNotes): Promise<void> {
  const order = await this.orderRepository.getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  if (order.status === 'cancelled') throw new Error('Order is already cancelled');
  if (order.status === 'completed') throw new Error('Cannot cancel a completed order');

  // ❌ No 24-hour check here — proceeds directly to refund
  // ...refund logic...
}
```

Only checks status — no time-based validation. The 24-hour rule exists in `AppointmentRepository.cancelAppointment()` (lines 553-562) but that endpoint is not used by either the web or mobile cancel flow.

---

## Fix Required

Add 24-hour advance check in `PaymentService.cancelOrder()` after the status checks:

```typescript
async cancelOrder(orderId, cancellationReason, cancellationNotes): Promise<void> {
  const order = await this.orderRepository.getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  if (order.status === 'cancelled') throw new Error('Order is already cancelled');
  if (order.status === 'completed') throw new Error('Cannot cancel a completed order');

  // Enforce 24-hour advance cancellation policy
  if (order.bookingDate && order.bookingTimeSlot) {
    const bookingDateTime = new Date(`${order.bookingDate}T${order.bookingTimeSlot}`);
    const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      throw new Error('Bookings must be cancelled at least 24 hours in advance');
    }
  }

  // ...existing refund logic...
}
```

The controller (`OrderController.cancelOrder()`) should catch this error and return a 400 response.

---

## File to Modify

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/services/PaymentService.ts:839-856` | Add 24-hour check after status validation |

---

## QA Test Plan

1. Create a booking for tomorrow (< 24 hours away)
2. Call `POST /api/services/orders/{id}/cancel` directly (via curl or Postman)
3. **Before fix**: Returns 200 — cancellation succeeds
4. **After fix**: Returns 400 — "Bookings must be cancelled at least 24 hours in advance"
5. Create a booking 2+ days in the future
6. Call cancel → should succeed (> 24 hours)
7. Verify web cancel still works for bookings > 24 hours away
8. Verify shop cancel (`/shop-cancel`) is unaffected — shops should be able to cancel anytime
