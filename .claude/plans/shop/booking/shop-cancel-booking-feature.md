# Shop Cancel Booking Feature Plan

**Created:** 2026-01-05
**Updated:** 2026-01-05
**Branch:** feature/86d179hc1-Shop-&-Customer-Booking-Problem
**Status:** Ready for Implementation
**Priority:** HIGH

---

## Feature Request

> Add a cancel button to the shop booking management UI, allowing shop owners to cancel customer bookings with reason tracking.

---

## Overview

Currently, only customers can cancel their bookings. Shop owners need the ability to cancel bookings when:
- Customer requests cancellation via phone/in-person
- Shop has capacity issues
- Service is no longer available
- Emergency/unforeseen circumstances

---

## Current State Analysis

### Existing Customer Cancellation Flow

| Component | Location | Status |
|-----------|----------|--------|
| Database | Migration 051 | `cancelled_at`, `cancellation_reason`, `cancellation_notes` fields exist |
| Backend Repository | `OrderRepository.ts:459-489` | `updateCancellationData()` method exists |
| Backend Controller | `OrderController.ts:376-414` | `cancelOrder` for customers only |
| Frontend API | `services.ts:386-401` | `cancelOrder()` function exists |
| Frontend Modal | `CancelBookingModal.tsx` | Customer-facing modal exists |

### What's Missing

| Component | Description |
|-----------|-------------|
| Backend Endpoint | Shop-specific cancel route with shop ownership validation |
| Frontend Button | Cancel button in `BookingCard.tsx` for shops |
| Frontend Handler | Cancel handler in `BookingsTabV2.tsx` |
| Frontend Modal | Shop-specific cancel modal (optional, can reuse existing) |
| API Client | Shop-specific cancel function |

---

## Implementation Plan

### Part A: Backend (Shop Cancel Endpoint)

#### A.1: Add Shop Cancel Endpoint to OrderController

**File:** `backend/src/domains/ServiceDomain/controllers/OrderController.ts`

Add new method after `cancelOrder`:

```typescript
/**
 * Cancel order (Shop only - can cancel paid/approved/scheduled orders)
 * POST /api/services/orders/:id/shop-cancel
 * Body: { cancellationReason: string, cancellationNotes?: string }
 */
cancelOrderByShop = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const { id } = req.params;
    const { cancellationReason, cancellationNotes } = req.body;

    // Validate cancellation reason
    if (!cancellationReason) {
      return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
    }

    // Verify order belongs to shop
    const order = await this.orderRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.shopId !== shopId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to cancel this order' });
    }

    // Can only cancel orders that are not already completed/cancelled
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a completed order' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Order is already cancelled' });
    }

    // Update order with cancellation data
    const updatedOrder = await this.orderRepository.updateCancellationData(
      id,
      `shop:${cancellationReason}`,  // Prefix to distinguish from customer cancellations
      cancellationNotes
    );

    // Send notification to customer
    try {
      const service = await this.serviceRepository.getServiceById(order.serviceId);
      const shop = await shopRepository.getShop(shopId);

      if (service && shop) {
        await this.notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: order.customerAddress,
          notificationType: 'service_cancelled_by_shop',
          message: `Your booking for ${service.serviceName} at ${shop.name} has been cancelled`,
          metadata: {
            orderId: id,
            serviceName: service.serviceName,
            shopName: shop.name,
            reason: cancellationReason,
            notes: cancellationNotes,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (notifError) {
      logger.error('Failed to send shop cancellation notification:', notifError);
    }

    // If order was paid, consider issuing refund (business logic)
    // Note: Refund handling can be added later based on business requirements

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: updatedOrder
    });
  } catch (error: unknown) {
    logger.error('Error in cancelOrderByShop controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel booking'
    });
  }
};
```

#### A.2: Add Route for Shop Cancellation

**File:** `backend/src/domains/ServiceDomain/routes.ts`

Add new route:

```typescript
// Shop cancel order (after other order routes)
router.post('/orders/:id/shop-cancel', authenticateJWT, requireShopAuth, orderController.cancelOrderByShop);
```

---

### Part B: Frontend API

#### B.1: Add Shop Cancel Function

**File:** `frontend/src/services/api/services.ts`

Add after `cancelOrder` function:

```typescript
/**
 * Cancel order by shop (Shop only)
 */
export const cancelOrderByShop = async (
  orderId: string,
  cancellationReason: string,
  cancellationNotes?: string
): Promise<boolean> => {
  try {
    await apiClient.post(`/services/orders/${orderId}/shop-cancel`, {
      cancellationReason,
      cancellationNotes,
    });
    return true;
  } catch (error) {
    console.error('Error canceling order by shop:', error);
    throw error;
  }
};
```

Also add to the `servicesApi` namespace export.

---

### Part C: Frontend UI

#### C.1: Update BookingCard Props

**File:** `frontend/src/components/shop/bookings/BookingCard.tsx`

Add new prop and handler:

```typescript
interface BookingCardProps {
  booking: MockBooking;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReschedule: () => void;
  onSchedule: () => void;
  onComplete: () => void;
  onCancel: () => void;  // NEW
}
```

Update `renderActionButtons()` to include Cancel button for cancellable statuses:

```typescript
const renderActionButtons = () => {
  // Common cancel button for all non-terminal statuses
  const cancelButton = (
    <button
      onClick={onCancel}
      className="px-3 py-1.5 text-sm font-medium text-red-400 bg-[#0D0D0D] border border-red-700 rounded-lg hover:border-red-500 hover:bg-red-900/20 transition-colors"
    >
      Cancel
    </button>
  );

  switch (booking.status) {
    case 'paid':
      return (
        <>
          {cancelButton}
          <button onClick={onReschedule}>Reschedule</button>
          <button onClick={onApprove}>Approve</button>
        </>
      );
    case 'approved':
      return (
        <>
          {cancelButton}
          <button onClick={onReschedule}>Reschedule</button>
          <button onClick={onSchedule}>Mark Scheduled</button>
        </>
      );
    case 'scheduled':
      return (
        <>
          {cancelButton}
          <button onClick={onReschedule}>Reschedule</button>
          <button onClick={onComplete}>Mark Complete</button>
        </>
      );
    default:
      return null;
  }
};

// Update hasActions to include all actionable statuses
const hasActions = ['paid', 'approved', 'scheduled'].includes(booking.status);
```

#### C.2: Add Cancel Modal Component

**File:** `frontend/src/components/shop/bookings/CancelBookingModal.tsx` (NEW)

```typescript
"use client";

import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { cancelOrderByShop } from "@/services/api/services";

interface CancelBookingModalProps {
  bookingId: string;
  serviceName: string;
  customerName: string;
  onClose: () => void;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'customer_request', label: 'Customer requested cancellation' },
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'service_unavailable', label: 'Service no longer available' },
  { value: 'capacity_issues', label: 'Capacity/resource issues' },
  { value: 'emergency', label: 'Emergency/unforeseen circumstances' },
  { value: 'other', label: 'Other' },
];

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  bookingId,
  serviceName,
  customerName,
  onClose,
  onCancelled,
}) => {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    setLoading(true);
    try {
      await cancelOrderByShop(bookingId, reason, notes || undefined);
      toast.success('Booking cancelled successfully');
      onCancelled();
      onClose();
    } catch (error) {
      toast.error('Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Cancel Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Booking Info */}
        <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm">Booking ID: <span className="text-white">{bookingId}</span></p>
          <p className="text-gray-400 text-sm mt-1">Service: <span className="text-white">{serviceName}</span></p>
          <p className="text-gray-400 text-sm mt-1">Customer: <span className="text-white">{customerName}</span></p>
        </div>

        {/* Warning */}
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">
            This action will cancel the booking and notify the customer. If the booking was paid, a refund may need to be processed separately.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Reason Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Cancellation Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-[#FFCC00] focus:outline-none"
              required
            >
              <option value="">Select a reason...</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details..."
              rows={3}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-[#FFCC00] focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Cancel Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

#### C.3: Update BookingsTabV2 with Cancel Handler

**File:** `frontend/src/components/shop/bookings/BookingsTabV2.tsx`

Add cancel modal state and handler:

```typescript
// Add state
const [cancelModalBooking, setCancelModalBooking] = useState<MockBooking | null>(null);

// Add handler
const handleCancel = (bookingId: string) => {
  const booking = bookings.find(b => b.bookingId === bookingId);
  if (booking) {
    setCancelModalBooking(booking);
  }
};

// Add to handleCancelled (after API call succeeds)
const handleCancelComplete = () => {
  // Update local state to show cancelled status
  if (cancelModalBooking) {
    setBookings(prev => prev.map(b => {
      if (b.bookingId === cancelModalBooking.bookingId) {
        const newTimeline = [
          ...b.timeline,
          {
            id: `tl-${Date.now()}`,
            type: 'cancelled' as const,
            timestamp: new Date().toISOString(),
            description: 'Booking cancelled by shop'
          }
        ];
        return { ...b, status: 'cancelled' as const, timeline: newTimeline };
      }
      return b;
    }));
  }
  setCancelModalBooking(null);
};

// Add modal to JSX (before closing div)
{cancelModalBooking && (
  <CancelBookingModal
    bookingId={cancelModalBooking.bookingId}
    serviceName={cancelModalBooking.serviceName}
    customerName={cancelModalBooking.customerName}
    onClose={() => setCancelModalBooking(null)}
    onCancelled={handleCancelComplete}
  />
)}
```

Update BookingCard usage to pass onCancel:

```typescript
<BookingCard
  key={booking.bookingId}
  booking={booking}
  isSelected={selectedBookingId === booking.bookingId}
  onSelect={() => setSelectedBookingId(booking.bookingId)}
  onApprove={() => handleApprove(booking.bookingId)}
  onReschedule={() => handleReschedule(booking.bookingId)}
  onSchedule={() => handleSchedule(booking.bookingId)}
  onComplete={() => handleComplete(booking.bookingId)}
  onCancel={() => handleCancel(booking.bookingId)}  // NEW
/>
```

#### C.4: Export Cancel Modal

**File:** `frontend/src/components/shop/bookings/index.ts`

Add export:

```typescript
export { CancelBookingModal } from './CancelBookingModal';
```

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | MODIFY | Add `cancelOrderByShop` method |
| `backend/src/domains/ServiceDomain/routes.ts` | MODIFY | Add `/orders/:id/shop-cancel` route |
| `frontend/src/services/api/services.ts` | MODIFY | Add `cancelOrderByShop` function |
| `frontend/src/components/shop/bookings/BookingCard.tsx` | MODIFY | Add Cancel button, `onCancel` prop |
| `frontend/src/components/shop/bookings/CancelBookingModal.tsx` | CREATE | Shop cancellation modal |
| `frontend/src/components/shop/bookings/BookingsTabV2.tsx` | MODIFY | Add cancel handler and modal integration |
| `frontend/src/components/shop/bookings/index.ts` | MODIFY | Export CancelBookingModal |

---

## Execution Order

1. **A.1-A.2: Backend** - Add shop cancel endpoint and route (must be first)
2. **B.1: Frontend API** - Add cancelOrderByShop function
3. **C.2: Cancel Modal** - Create the modal component
4. **C.1: BookingCard** - Add Cancel button and onCancel prop
5. **C.3: BookingsTabV2** - Integrate cancel handler and modal
6. **C.4: Export** - Update index.ts

---

## Agent Execution Strategy

```
+-----------------------------------------------------------------------+
|                    SHOP CANCEL BOOKING FEATURE                         |
+-----------------------------------------------------------------------+

+--------------------------+
| A: BACKEND (Sequential)  |
+--------------------------+
|  Agent: backend-architect|
|  Tasks:                  |
|  - OrderController.ts    |
|  - routes.ts             |
+--------------------------+
              |
              v
+----------------------------------------------------------+
| B + C: FRONTEND (Parallel after backend)                  |
+----------------------------------------------------------+
|  Agent: frontend-architect                                |
|  Tasks:                                                  |
|  - services.ts API client                                |
|  - CancelBookingModal.tsx (new)                          |
|  - BookingCard.tsx (add button)                          |
|  - BookingsTabV2.tsx (integrate)                         |
|  - index.ts (export)                                     |
+----------------------------------------------------------+
              |
              v
+--------------------------+
| D: BUILD VERIFICATION    |
+--------------------------+
|  cd frontend && npm run build                            |
|  cd backend && npm run build                             |
+--------------------------+
```

### Agent Assignments

| Step | Agent Type | Files | Notes |
|------|------------|-------|-------|
| **A** | `backend-architect` | OrderController.ts, routes.ts | Must complete first |
| **B+C** | `frontend-architect` | 5 frontend files | Can run after backend |

---

## Testing Checklist

- [ ] Shop can see Cancel button on paid, approved, and scheduled bookings
- [ ] Cancel button opens confirmation modal
- [ ] Modal shows booking details and reason selection
- [ ] Reason is required for cancellation
- [ ] Optional notes can be added
- [ ] API call succeeds and returns updated order
- [ ] Booking status updates to "cancelled" in UI
- [ ] Customer receives notification about cancellation
- [ ] Completed and already-cancelled bookings cannot be cancelled
- [ ] Non-shop users cannot access shop-cancel endpoint
- [ ] Error states handled gracefully

---

## Cancellation Reasons

| Code | Display Label |
|------|---------------|
| `customer_request` | Customer requested cancellation |
| `schedule_conflict` | Schedule conflict |
| `service_unavailable` | Service no longer available |
| `capacity_issues` | Capacity/resource issues |
| `emergency` | Emergency/unforeseen circumstances |
| `other` | Other |

**Note:** Reasons are prefixed with `shop:` in database to distinguish from customer cancellations.

---

## Future Enhancements (Not in scope)

1. **Automatic Refund Processing** - Integrate with Stripe to auto-refund paid bookings
2. **Cancellation Policy** - Time-based cancellation rules (24hr notice, etc.)
3. **Customer Cancel via Shop** - Allow shop to cancel on behalf of customer with customer's reason codes
4. **Cancellation Analytics** - Track cancellation patterns for business insights
5. **Email Notifications** - Send email in addition to in-app notification
