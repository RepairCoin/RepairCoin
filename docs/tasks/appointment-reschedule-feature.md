# Appointment Reschedule Feature Strategy

## Overview

This document outlines the strategy for implementing a feature that allows customers to change their appointment date/time after booking. The feature prioritizes shop schedule integrity by requiring shop approval for all reschedule requests.

---

## Current System Summary

### Customer Booking Flow
1. Customer selects service → Opens `ServiceCheckoutModal`
2. Selects date via `DateAvailabilityPicker` (calendar view)
3. Selects time via `TimeSlotPicker` (grid of available slots)
4. Applies RCN discount (optional)
5. Completes Stripe payment
6. Appointment confirmed with `booking_time_slot` stored in `service_orders`

### Shop Availability Configuration
- **Operating Hours**: Per day-of-week open/close times with optional breaks
- **Booking Settings**: Slot duration, buffer time, max concurrent bookings, advance booking days, minimum notice hours
- **Date Overrides**: Holiday closures or custom hours for specific dates

### Key Database Tables
- `service_orders` - Contains `booking_date`, `booking_time_slot`, `booking_end_time`
- `shop_availability` - Operating hours per day
- `shop_time_slot_config` - Booking rules (duration, buffer, min notice, etc.)
- `shop_date_overrides` - Holidays and special hours

### Current Cancellation Policy
- Customers can cancel 24+ hours before appointment
- Cannot cancel completed or already-cancelled orders

---

## Proposed Feature: Appointment Rescheduling with Shop Approval

### Why Shop Approval?

**Protecting Shop Schedules:**
1. Shops may have prepared resources/staff for the original time
2. Last-minute changes could leave gaps that can't be filled
3. Some shops have limited availability and need to control their calendar
4. Prevents abuse (constant rescheduling)

**Business Benefits:**
- Shops maintain control over their schedule
- Reduces no-shows (customer commits to new time)
- Professional communication between shop and customer
- Creates audit trail of schedule changes

---

## UI Design

### Customer Side - My Appointments Page

**Location:** As shown in screenshot - "My Appointments" page at `/customer?tab=appointments`

**Current UI:**
```
┌─────────────────────────────────────────────────────┐
│ service 20                                    [PAID]│
│ dc_shopu                                            │
│ Thu, Jan 1, 2026                                    │
│ 10:00 AM - 11:00 AM                                 │
│ $3.00                                               │
│                                    [View Details]   │
│ ⚠ Cancellation is only available 24+ hours before  │
└─────────────────────────────────────────────────────┘
```

**Proposed UI with Edit Button:**
```
┌─────────────────────────────────────────────────────┐
│ service 20                                    [PAID]│
│ dc_shopu                                            │
│ Thu, Jan 1, 2026                                    │
│ 10:00 AM - 11:00 AM                                 │
│ $3.00                                               │
│                         [Edit Time] [View Details]  │
│ ⚠ Cancellation is only available 24+ hours before  │
└─────────────────────────────────────────────────────┘
```

**Edit Time Button Rules:**
- Only visible for orders with status: `paid`, `confirmed`
- Hidden for: `pending`, `completed`, `cancelled`, `refunded`, `in_progress`
- Hidden if appointment is within 24 hours (same as cancellation policy)
- Hidden if there's a pending reschedule request

**Click "Edit Time" → Opens Reschedule Modal:**
```
┌─────────────────────────────────────────────────────┐
│           Request Appointment Change                │
├─────────────────────────────────────────────────────┤
│ Current Appointment:                                │
│ Thu, Jan 1, 2026 at 10:00 AM - 11:00 AM            │
│                                                     │
│ Select New Date:                                    │
│ ┌─────────────────────────────────────────┐        │
│ │     [DateAvailabilityPicker]            │        │
│ └─────────────────────────────────────────┘        │
│                                                     │
│ Select New Time:                                    │
│ ┌─────────────────────────────────────────┐        │
│ │     [TimeSlotPicker]                    │        │
│ └─────────────────────────────────────────┘        │
│                                                     │
│ Reason for Change (optional):                       │
│ ┌─────────────────────────────────────────┐        │
│ │                                         │        │
│ └─────────────────────────────────────────┘        │
│                                                     │
│ ⚠ This request will be sent to the shop for       │
│   approval. You will be notified of their decision.│
│                                                     │
│        [Cancel]              [Submit Request]       │
└─────────────────────────────────────────────────────┘
```

### Shop Side - Reschedule Requests

**Option 1: Notification Bell + Approvals Tab**
- Shop receives notification when reschedule request comes in
- Navigate to "Approvals" or dedicated "Reschedule Requests" section

**Option 2: Integrated into Appointment Calendar**
- Show pending reschedule requests with special indicator
- Click to view and approve/reject

**Proposed: Shop Dashboard → Appointments → "Reschedule Requests" Tab**
```
┌─────────────────────────────────────────────────────┐
│ Reschedule Requests (2 pending)                     │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ Customer: John Doe                              ││
│ │ Service: Oil Change                             ││
│ │ Current: Jan 5, 2026 at 2:00 PM                ││
│ │ Requested: Jan 7, 2026 at 10:00 AM             ││
│ │ Reason: "Work schedule conflict"                ││
│ │ Requested: 2 hours ago                          ││
│ │                                                 ││
│ │ [Approve]  [Reject]  [Suggest Alternative]     ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Approve Action:**
- Updates `service_orders` with new date/time
- Sends notification to customer
- Original time slot becomes available again

**Reject Action:**
- Optional reason field
- Sends notification to customer
- Original appointment remains unchanged

**Suggest Alternative (Optional Enhancement):**
- Shop can propose different time
- Creates counter-offer flow

---

## Database Schema Changes

### New Table: `appointment_reschedule_requests`

```sql
CREATE TABLE appointment_reschedule_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL REFERENCES service_orders(order_id),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  customer_address VARCHAR(255) NOT NULL,

  -- Original appointment
  original_date DATE NOT NULL,
  original_time_slot TIME NOT NULL,
  original_end_time TIME,

  -- Requested new appointment
  requested_date DATE NOT NULL,
  requested_time_slot TIME NOT NULL,
  requested_end_time TIME,

  -- Request details
  customer_reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Values: 'pending', 'approved', 'rejected', 'expired', 'cancelled'

  -- Shop response
  shop_response_reason TEXT,
  responded_at TIMESTAMP,
  responded_by VARCHAR(255), -- shop wallet address

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Auto-expire after X hours if no response

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX idx_reschedule_shop_status ON appointment_reschedule_requests(shop_id, status);
CREATE INDEX idx_reschedule_order ON appointment_reschedule_requests(order_id);
CREATE INDEX idx_reschedule_customer ON appointment_reschedule_requests(customer_address);
CREATE INDEX idx_reschedule_expires ON appointment_reschedule_requests(expires_at) WHERE status = 'pending';
```

### Modify `service_orders` Table

```sql
-- Add column to track if there's a pending reschedule request
ALTER TABLE service_orders ADD COLUMN has_pending_reschedule BOOLEAN DEFAULT FALSE;

-- Add reschedule history tracking
ALTER TABLE service_orders ADD COLUMN reschedule_count INTEGER DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN last_rescheduled_at TIMESTAMP;
```

---

## API Endpoints

### Customer Endpoints

```typescript
// Create reschedule request
POST /api/services/appointments/reschedule-request
Body: {
  orderId: string;
  requestedDate: string;      // "2026-01-07"
  requestedTimeSlot: string;  // "10:00"
  reason?: string;
}
Response: {
  success: boolean;
  requestId: string;
  message: string;
}

// Cancel own reschedule request (before shop responds)
DELETE /api/services/appointments/reschedule-request/:requestId
Response: {
  success: boolean;
  message: string;
}

// Get reschedule request status for an order
GET /api/services/appointments/reschedule-request/order/:orderId
Response: {
  hasPendingRequest: boolean;
  request?: RescheduleRequest;
}
```

### Shop Endpoints

```typescript
// Get all reschedule requests for shop
GET /api/services/appointments/reschedule-requests
Query: { status?: 'pending' | 'approved' | 'rejected' | 'all' }
Response: {
  requests: RescheduleRequest[];
  pendingCount: number;
}

// Approve reschedule request
POST /api/services/appointments/reschedule-request/:requestId/approve
Response: {
  success: boolean;
  message: string;
  updatedOrder: ServiceOrder;
}

// Reject reschedule request
POST /api/services/appointments/reschedule-request/:requestId/reject
Body: {
  reason?: string;
}
Response: {
  success: boolean;
  message: string;
}
```

---

## Business Rules & Constraints

### Customer Rules

| Rule | Description |
|------|-------------|
| **24-Hour Minimum** | Cannot request reschedule if original appointment is within 24 hours |
| **One Pending Request** | Only one pending reschedule request per order at a time |
| **Valid Time Slot** | Requested time must be available (not already booked) |
| **Within Booking Window** | New date must be within shop's `booking_advance_days` |
| **Reschedule Limit** | Maximum 2-3 reschedules per order (configurable) |
| **Status Restriction** | Can only reschedule `paid` or `confirmed` orders |

### Shop Rules

| Rule | Description |
|------|-------------|
| **Response Deadline** | Requests auto-expire after 48 hours (configurable) |
| **Approval Updates Order** | Approving updates `service_orders` with new date/time |
| **Slot Validation** | System verifies requested slot is still available before approval |
| **Notification Required** | Customer must be notified of decision |

### Time Slot Protection

When a reschedule request is pending:
- **Original slot**: Remains booked (not released until approved)
- **Requested slot**: NOT reserved (could be booked by someone else)
- **If requested slot taken**: Shop can reject or suggest alternative

---

## Notification Flow

### Customer Notifications

| Event | Notification Type | Message |
|-------|------------------|---------|
| Request Submitted | In-app + Email | "Your reschedule request has been submitted. The shop will respond within 48 hours." |
| Request Approved | In-app + Email | "Great news! Your appointment has been rescheduled to [new date/time]." |
| Request Rejected | In-app + Email | "Your reschedule request was declined. [Reason if provided]. Your original appointment remains: [date/time]." |
| Request Expired | In-app | "Your reschedule request expired without a response. Your original appointment remains: [date/time]." |

### Shop Notifications

| Event | Notification Type | Message |
|-------|------------------|---------|
| New Request | In-app + Email | "New reschedule request from [customer] for [service]. Please respond within 48 hours." |
| Request Expiring Soon | In-app | "Reminder: Reschedule request from [customer] expires in 6 hours." |

---

## Frontend Components

### New Components

```
frontend/src/components/customer/
├── RescheduleModal.tsx           # Main modal for requesting reschedule
├── RescheduleRequestStatus.tsx   # Shows pending request status on appointment card

frontend/src/components/shop/
├── RescheduleRequestsTab.tsx     # Tab showing all reschedule requests
├── RescheduleRequestCard.tsx     # Individual request with approve/reject buttons
```

### Modified Components

```
frontend/src/components/customer/
├── AppointmentCard.tsx           # Add "Edit Time" button

frontend/src/components/shop/
├── ShopDashboardLayout.tsx       # Add reschedule requests tab/badge
├── AppointmentCalendar.tsx       # Show indicator for appointments with pending requests
```

### API Service

```typescript
// frontend/src/services/api/appointments.ts

// Add new methods:
createRescheduleRequest(orderId: string, data: RescheduleRequestData): Promise<RescheduleResponse>
cancelRescheduleRequest(requestId: string): Promise<void>
getRescheduleRequestForOrder(orderId: string): Promise<RescheduleRequest | null>
getShopRescheduleRequests(status?: string): Promise<RescheduleRequest[]>
approveRescheduleRequest(requestId: string): Promise<void>
rejectRescheduleRequest(requestId: string, reason?: string): Promise<void>
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Backend)
1. Create database migration for `appointment_reschedule_requests` table
2. Create `RescheduleRepository` with CRUD operations
3. Create `RescheduleService` with business logic
4. Add API endpoints to `AppointmentController`
5. Add notification templates

### Phase 2: Customer UI
1. Add "Edit Time" button to appointment cards
2. Create `RescheduleModal` component (reuse DateAvailabilityPicker & TimeSlotPicker)
3. Show pending request status on appointment
4. Handle notifications

### Phase 3: Shop UI
1. Create `RescheduleRequestsTab` component
2. Add badge to navigation showing pending count
3. Implement approve/reject flows
4. Show indicators on calendar for affected appointments

### Phase 4: Notifications & Polish
1. Integrate with existing notification system
2. Add email templates for reschedule events
3. Implement request expiration job
4. Add analytics tracking

---

## Edge Cases & Considerations

### Concurrent Booking Conflict
**Scenario:** Customer A requests to reschedule to 10:00 AM. Before shop approves, Customer B books 10:00 AM.
**Solution:** On approval, system checks if slot is still available. If not, auto-reject with message: "Sorry, that time slot is no longer available."

### Shop Closes on Requested Date
**Scenario:** Customer requests reschedule to Jan 10. Shop adds holiday override for Jan 10.
**Solution:** System validates slot availability at approval time. If date is now closed, reject automatically.

### Multiple Rapid Requests
**Scenario:** Customer submits request, cancels, submits new request repeatedly.
**Solution:**
- Rate limit: Max 3 reschedule requests per order per week
- Cooldown period: 1 hour between request submissions

### Request While Order Being Completed
**Scenario:** Shop starts completing order while reschedule request is pending.
**Solution:** Auto-cancel pending request when order status changes to `in_progress` or `completed`.

### Expired Request Handling
**Scenario:** 48 hours pass without shop response.
**Solution:**
- Background job marks request as `expired`
- Customer notified
- Original appointment unchanged
- Shop can still see expired requests in history

---

## Configuration Options (Future Enhancement)

Allow shops to configure their reschedule policy:

```typescript
interface ShopReschedulePolicy {
  allowReschedule: boolean;           // Enable/disable feature
  maxReschedulesPerOrder: number;     // Default: 2
  minHoursBeforeReschedule: number;   // Default: 24 (same as cancellation)
  requestExpirationHours: number;     // Default: 48
  autoApprove: boolean;               // Auto-approve if slot available (no manual review)
  requireReason: boolean;             // Require customer to provide reason
}
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Reschedule request approval rate | > 80% |
| Average shop response time | < 12 hours |
| Customer satisfaction with feature | > 4.5/5 |
| Reduction in no-shows | 15% improvement |
| Feature adoption rate | 20% of bookings use reschedule within 3 months |

---

## Summary

This feature implements appointment rescheduling with **mandatory shop approval** to protect shop schedules while giving customers flexibility. The approval-based approach:

1. **Protects shops** from last-minute disruptions
2. **Empowers customers** to request changes professionally
3. **Creates communication** between both parties
4. **Maintains integrity** of the booking system
5. **Provides audit trail** for schedule changes

The implementation reuses existing components (DateAvailabilityPicker, TimeSlotPicker) and follows established patterns in the codebase.
