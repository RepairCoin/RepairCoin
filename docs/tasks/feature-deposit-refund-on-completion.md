# Feature: Refund Deposit When Shop Marks Booking Complete

## Status: Open
## Priority: High
## Date: 2026-03-23
## Category: Feature - Payments

---

## Problem

When a customer at `deposit_required` tier books a service, a $25 refundable deposit is added to their Stripe payment. The UI promises:
- "Deposit will be fully refunded when you attend your appointment"
- "Complete 3 successful appointments to remove deposit requirement"

However, **no code exists to process the deposit refund** when the shop marks the booking as complete. The customer pays the extra $25 but never gets it back.

---

## Current Flow

| Step | Status |
|------|--------|
| Deposit added to Stripe checkout ($59 + $25 = $84) | Working |
| Customer pays via card | Working |
| UI shows deposit breakdown and recovery progress | Working |
| Email mentions deposit will be refunded | Working |
| **Refund $25 when shop marks "Complete"** | **NOT IMPLEMENTED** |
| **Increment successful appointment count toward tier reset** | **Partially implemented** — `successfulAppointmentsSinceTier3` field exists, `recordSuccessfulAppointment()` method exists, but may not be called on order completion |

---

## Implementation Plan

### 1. On Order Completion — Process Deposit Refund

**File:** `backend/src/domains/ServiceDomain/controllers/OrderController.ts` — `markComplete` method

When the shop marks an order as complete:
1. Check if the order has a deposit (`metadata.requiresDeposit === "true"` or a `deposit_amount` field)
2. Get the Stripe Payment Intent ID from the order
3. Issue a **partial refund** of the deposit amount via `StripeService.refundPayment()`
4. Record the refund in the order or transactions table
5. Send notification/email to customer confirming deposit refund

```typescript
// Pseudo-code
if (order.requiresDeposit && order.stripePaymentIntentId) {
  const depositAmount = order.depositAmount || 25.00;
  const refundAmountCents = Math.round(depositAmount * 100);

  await stripeService.createPartialRefund(
    order.stripePaymentIntentId,
    refundAmountCents,
    'Deposit refund - customer attended appointment'
  );
}
```

### 2. Track Deposit in Order Record

**File:** `backend/src/repositories/OrderRepository.ts`

The `service_orders` table needs to track deposit info. Options:
- **Option A:** Add `deposit_amount` and `deposit_refunded` columns to `service_orders`
- **Option B:** Read from Stripe metadata (`requiresDeposit`, `depositAmount` stored at checkout)

Option B is simpler (no migration needed) — the metadata is already stored on the Stripe Payment Intent.

### 3. Increment Successful Appointment Counter

**File:** `backend/src/services/NoShowPolicyService.ts` — `recordSuccessfulAppointment()`

On completion, call:
```typescript
await noShowPolicyService.recordSuccessfulAppointment(order.customerAddress);
```

This increments `successful_appointments_since_tier3`. After 3 successful appointments, the deposit requirement should be automatically removed (tier downgraded).

### 4. Stripe Partial Refund Method

**File:** `backend/src/services/StripeService.ts`

A `refundPayment()` method already exists (line 380). It does full refunds. Need to add or modify for partial refunds:

```typescript
async createPartialRefund(paymentIntentId: string, amountCents: number, reason?: string): Promise<Stripe.Refund> {
  const refund = await this.stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountCents,  // partial refund
    reason: 'requested_by_customer',
  });
  return refund;
}
```

### 5. Customer Notification

After refund:
- In-app notification: "Your $25 deposit has been refunded for [service name]"
- Email (optional): Deposit refund confirmation with Stripe receipt

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Add deposit refund logic to `markComplete` |
| `backend/src/services/StripeService.ts` | Add partial refund method (or reuse existing with amount param) |
| `backend/src/services/NoShowPolicyService.ts` | Call `recordSuccessfulAppointment()` on completion |
| `backend/src/services/EmailService.ts` | Optional: deposit refund email template |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Shop marks complete but Stripe refund fails | Log error, don't block completion. Queue for retry or manual refund. |
| Customer cancels before appointment | Full refund of service + deposit (existing cancellation flow) |
| Customer no-shows with deposit | Deposit is NOT refunded (penalty) |
| Order was already refunded | Check Stripe refund status before attempting |
| Deposit amount is $0 (policy changed after booking) | Skip refund if amount is 0 |

---

## Verification Checklist

- [ ] Book a service as `deposit_required` customer → $84 charged ($59 + $25)
- [ ] Shop marks booking as complete
- [ ] Stripe shows partial refund of $25
- [ ] Customer receives deposit refund notification
- [ ] `successful_appointments_since_tier3` incremented
- [ ] After 3 completions → deposit requirement removed (tier downgraded)
- [ ] No-show booking → deposit NOT refunded
- [ ] Cancelled booking → full refund (service + deposit)

---

## Related

- `docs/tasks/bug-deposit-amount-string-concatenation-overcharge.md` — deposit calculation bug (fixed)
- `backend/src/services/NoShowPolicyService.ts` — tier system and deposit policy
- `backend/src/services/StripeService.ts` — existing refund method
- `frontend/src/components/customer/ServiceCheckoutModal.tsx` — deposit UI display
