# Customer Cancellation & Refund Feature

## Overview

This document analyzes the current booking cancellation system and proposes enhancements for implementing customer refunds with shop protection mechanisms.

---

## Current Implementation Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CANCELLATION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Customer UI                                                                │
│       │                                                                      │
│       ▼                                                                      │
│   CancelBookingModal.tsx ─────┐                                             │
│       │                       │                                             │
│       ▼                       ▼                                             │
│   /orders/:id/cancel    /appointments/cancel/:orderId                       │
│       │                       │                                             │
│       ▼                       ▼                                             │
│   PaymentService          AppointmentRepository                             │
│   .cancelOrder()          .cancelAppointment()                              │
│       │                       │                                             │
│       ├── RCN Refund          └── Status Update Only                        │
│       ├── Stripe Refund           (24hr restriction)                        │
│       └── Notifications           ⚠️ NO REFUND                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Location | Purpose |
|------|----------|---------|
| `CancelBookingModal.tsx` | `frontend/src/components/customer/` | UI for cancellation with reason selection |
| `PaymentService.ts` | `backend/src/domains/ServiceDomain/services/` | Full cancellation + refund logic |
| `AppointmentRepository.ts` | `backend/src/repositories/` | Appointment cancellation with 24hr check |
| `OrderController.ts` | `backend/src/domains/ServiceDomain/controllers/` | Order cancellation endpoint |
| `AppointmentController.ts` | `backend/src/domains/ServiceDomain/controllers/` | Appointment cancellation endpoint |
| `StripeService.ts` | `backend/src/services/` | Stripe refund processing |
| `CustomerRepository.ts` | `backend/src/repositories/` | RCN balance refund |

---

## Current Cancellation Endpoints

### 1. Order Cancellation (Full Refund)
```
POST /api/services/orders/:id/cancel
Body: { cancellationReason: string, cancellationNotes?: string }
```

**Behavior:**
- Validates order ownership and status
- Refunds RCN tokens if redeemed
- Processes Stripe refund if payment was made
- Updates order status to 'cancelled'
- Sends notifications to customer and shop

### 2. Appointment Cancellation (No Refund - BUG!)
```
POST /api/services/appointments/cancel/:orderId
```

**Behavior:**
- Validates ownership and status
- Enforces 24-hour cancellation policy
- Only updates status to 'cancelled'
- **DOES NOT process refunds**

---

## Identified Issues

### Critical: Dual Endpoint Confusion
There are two cancellation endpoints with different behaviors:
1. `/orders/:id/cancel` - Handles refunds
2. `/appointments/cancel/:orderId` - Does NOT handle refunds

**Risk:** If frontend calls the appointment endpoint, customer doesn't get refund despite cancellation succeeding.

### Current Behavior Gaps
1. No configurable refund policies (e.g., 50% refund within 24 hours)
2. No partial refund support
3. 24-hour restriction is hardcoded, not shop-configurable
4. No cancellation fee mechanism

---

## Shop Protection Mechanisms

### Current Protection: 24-Hour Cancellation Policy

**Location:** `AppointmentRepository.ts:516-524`

```typescript
// Check 24-hour cancellation policy
if (order.booking_date && order.booking_time_slot) {
  const bookingDateTime = new Date(`${order.booking_date} ${order.booking_time_slot}`);
  const now = new Date();
  const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 24) {
    throw new Error('Appointments must be cancelled at least 24 hours in advance');
  }
}
```

**Limitation:** This only applies to the appointment endpoint, not the order cancellation endpoint.

---

## Proposed Refund Policy System

### Tiered Refund Structure

| Time Before Appointment | Refund Percentage | Shop Protection |
|------------------------|-------------------|-----------------|
| 48+ hours | 100% | Low risk - ample time to rebook |
| 24-48 hours | 75% | Moderate - shop keeps 25% fee |
| 12-24 hours | 50% | High risk - shop keeps 50% fee |
| 6-12 hours | 25% | Very high risk - minimal refund |
| < 6 hours | 0% | No refund - shop fully protected |

### No-Show Policy
- Customer doesn't show up: No refund
- Shop can mark as "no-show" after appointment time
- Affects customer trust score (future feature)

---

## Database Schema Changes

### New Table: `shop_cancellation_policies`

```sql
CREATE TABLE shop_cancellation_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Refund tiers (hours before appointment → refund percentage)
  full_refund_hours INTEGER DEFAULT 48,        -- 100% refund if cancelled before this
  high_refund_hours INTEGER DEFAULT 24,        -- 75% refund threshold
  medium_refund_hours INTEGER DEFAULT 12,      -- 50% refund threshold
  low_refund_hours INTEGER DEFAULT 6,          -- 25% refund threshold

  -- Percentages
  full_refund_percentage DECIMAL(5,2) DEFAULT 100.00,
  high_refund_percentage DECIMAL(5,2) DEFAULT 75.00,
  medium_refund_percentage DECIMAL(5,2) DEFAULT 50.00,
  low_refund_percentage DECIMAL(5,2) DEFAULT 25.00,

  -- Options
  allow_last_minute_cancel BOOLEAN DEFAULT false,  -- Allow < 6 hours with 0% refund
  cancellation_fee_usd DECIMAL(10,2) DEFAULT 0,    -- Fixed fee deducted from all refunds

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(shop_id)
);
```

### Update: `service_orders` table

```sql
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS refund_amount_usd DECIMAL(10,2);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS refund_percentage DECIMAL(5,2);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20); -- pending, processed, failed
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS stripe_refund_id VARCHAR(255);
```

---

## Implementation Plan

### Phase 1: Fix Current Issues
1. **Consolidate cancellation endpoints** - Both should use the same refund logic
2. **Add 24-hour check to PaymentService.cancelOrder()**
3. **Ensure refund always processes on cancellation**

### Phase 2: Shop-Configurable Policies
1. Create `shop_cancellation_policies` table
2. Add shop settings UI for cancellation policy
3. Implement tiered refund calculation service

### Phase 3: Enhanced Refund Processing
1. Add partial refund support to StripeService
2. Implement RCN partial refund logic
3. Add refund tracking and history

### Phase 4: UI Enhancements
1. Show refund amount preview before cancellation
2. Display shop's cancellation policy on booking page
3. Add cancellation policy to order confirmation email

---

## API Changes

### New: Calculate Refund Preview
```
GET /api/services/orders/:id/refund-preview
Response: {
  refundPercentage: number,
  refundAmountUsd: number,
  rcnRefund: number,
  cancellationFee: number,
  hoursUntilAppointment: number,
  policyMessage: string
}
```

### Updated: Cancel Order
```
POST /api/services/orders/:id/cancel
Body: {
  cancellationReason: string,
  cancellationNotes?: string,
  acceptPartialRefund?: boolean  // Required if partial refund applies
}
Response: {
  success: boolean,
  refundAmount: number,
  rcnRefunded: number,
  refundPercentage: number,
  message: string
}
```

---

## Code Implementation

### Refund Calculation Service

```typescript
// backend/src/domains/ServiceDomain/services/RefundCalculationService.ts

export interface RefundCalculation {
  refundPercentage: number;
  refundAmountUsd: number;
  rcnRefund: number;
  cancellationFee: number;
  hoursUntilAppointment: number;
  isAllowed: boolean;
  reason?: string;
}

export class RefundCalculationService {
  async calculateRefund(orderId: string): Promise<RefundCalculation> {
    const order = await this.orderRepository.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const policy = await this.getCancellationPolicy(order.shopId);
    const hoursUntil = this.calculateHoursUntilAppointment(order);

    let percentage = 0;

    if (hoursUntil >= policy.fullRefundHours) {
      percentage = policy.fullRefundPercentage;
    } else if (hoursUntil >= policy.highRefundHours) {
      percentage = policy.highRefundPercentage;
    } else if (hoursUntil >= policy.mediumRefundHours) {
      percentage = policy.mediumRefundPercentage;
    } else if (hoursUntil >= policy.lowRefundHours) {
      percentage = policy.lowRefundPercentage;
    } else if (policy.allowLastMinuteCancel) {
      percentage = 0;
    } else {
      return {
        refundPercentage: 0,
        refundAmountUsd: 0,
        rcnRefund: 0,
        cancellationFee: 0,
        hoursUntilAppointment: hoursUntil,
        isAllowed: false,
        reason: `Cancellations must be made at least ${policy.lowRefundHours} hours in advance`
      };
    }

    const baseRefund = order.finalAmountUsd * (percentage / 100);
    const netRefund = Math.max(0, baseRefund - policy.cancellationFeeUsd);
    const rcnRefund = order.rcnRedeemed * (percentage / 100);

    return {
      refundPercentage: percentage,
      refundAmountUsd: netRefund,
      rcnRefund: Math.floor(rcnRefund),
      cancellationFee: policy.cancellationFeeUsd,
      hoursUntilAppointment: hoursUntil,
      isAllowed: true
    };
  }
}
```

---

## Frontend UI Updates

### CancelBookingModal Enhancements

```typescript
// Show refund preview before cancellation
const RefundPreview = ({ order }) => {
  const [preview, setPreview] = useState<RefundPreview | null>(null);

  useEffect(() => {
    loadRefundPreview();
  }, [order.orderId]);

  if (!preview) return <Loader />;

  return (
    <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
      <h4 className="font-semibold text-white mb-3">Refund Summary</h4>

      {preview.refundPercentage < 100 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mb-3">
          <p className="text-yellow-200 text-sm">
            ⚠️ Partial refund: {preview.refundPercentage}%
            (Appointment in {preview.hoursUntilAppointment.toFixed(1)} hours)
          </p>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Original Amount:</span>
          <span className="text-white">${order.finalAmountUsd.toFixed(2)}</span>
        </div>
        {preview.cancellationFee > 0 && (
          <div className="flex justify-between text-red-400">
            <span>Cancellation Fee:</span>
            <span>-${preview.cancellationFee.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span className="text-gray-400">You'll Receive:</span>
          <span className="text-green-400">${preview.refundAmountUsd.toFixed(2)}</span>
        </div>
        {preview.rcnRefund > 0 && (
          <div className="flex justify-between text-yellow-400">
            <span>RCN Refund:</span>
            <span>+{preview.rcnRefund} RCN</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## Shop Dashboard: Cancellation Policy Settings

### Settings UI Location
`frontend/src/components/shop/settings/CancellationPolicySettings.tsx`

### Features
- Enable/disable cancellation policy
- Set refund percentages for each time tier
- Set minimum cancellation notice hours
- Optional cancellation fee
- Preview how policy appears to customers

---

## Testing Checklist

### Unit Tests
- [ ] RefundCalculationService calculates correct percentages
- [ ] Stripe partial refund processes correctly
- [ ] RCN partial refund calculates correctly
- [ ] Cancellation fee deduction works

### Integration Tests
- [ ] Full cancellation flow with 100% refund
- [ ] Partial refund at each tier threshold
- [ ] Last-minute cancellation blocked/allowed based on policy
- [ ] RCN + Stripe combined refund

### E2E Tests
- [ ] Customer cancels > 48 hours - gets full refund
- [ ] Customer cancels < 24 hours - gets partial refund
- [ ] Customer attempts cancel < 6 hours - sees appropriate message
- [ ] Shop receives cancellation notification
- [ ] Refund appears in customer's Stripe account

---

## Migration Path

1. **Add new columns** to service_orders table
2. **Create shop_cancellation_policies** table with defaults
3. **Update PaymentService** with refund calculation
4. **Add shop settings UI** for policy configuration
5. **Update CancelBookingModal** with refund preview
6. **Deprecate** `/appointments/cancel/:orderId` endpoint
7. **Add monitoring** for refund success/failure rates

---

## Summary

### Current State
- Basic cancellation works with full refund
- 24-hour restriction exists but inconsistently applied
- No partial refund support
- No shop-configurable policies

### Target State
- Tiered refund system based on time until appointment
- Shop-configurable cancellation policies
- Partial refund support for Stripe and RCN
- Clear refund preview before customer confirms cancellation
- Shop protection from last-minute cancellations with fee retention

---

*Document created: January 2, 2026*
*Status: Ready for implementation planning*
