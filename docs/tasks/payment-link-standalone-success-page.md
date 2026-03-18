# Payment Link: Standalone Success Page

## Status: Open
## Priority: High
## Date: 2026-03-18
## Category: Bug Fix / UX

---

## Problem

When a shop creates a manual booking with "Send Link" payment status, the customer receives an email with a Stripe payment link. After successful payment, Stripe redirects to:

```
/customer?tab=orders&payment=success&orderId={orderId}
```

This redirect lands on the authenticated customer dashboard. If a **different customer** is already logged in on the same browser, they see the order page under the wrong account — causing either:
- Data leakage (wrong customer sees the order details)
- An error (order doesn't belong to the logged-in user)
- Confusion (paying customer isn't logged in at all, gets redirected to login)

### Reproduction Steps
1. Shop (peanut) books a manual appointment for Customer A (0x6cd0...) via "Send Link"
2. Customer A receives the payment email link
3. Customer B (0x960a...) is logged in on the same browser
4. Customer A opens the link, completes Stripe payment
5. Stripe redirects to `/customer?tab=orders&payment=success&orderId=...`
6. Customer B's session is active → wrong account sees the order

---

## Solution: Standalone Payment Success Page

Create a dedicated `/payment/success` page that:
- Does **NOT** require authentication
- Shows payment confirmation with order summary
- Is completely independent from the customer dashboard
- Works for customers with or without RepairCoin accounts

---

## Implementation Plan

### 1. Create Stripe success redirect URL

**Current:** Stripe redirects to `/customer?tab=orders&payment=success&orderId={orderId}`

**New:** Stripe redirects to `/payment/success?orderId={orderId}&session_id={CHECKOUT_SESSION_ID}`

**File to update:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts`
- Update the Stripe checkout session `success_url` to point to `/payment/success`

### 2. Create backend endpoint for order summary (no auth)

**New endpoint:** `GET /api/services/orders/:orderId/payment-summary`

- No authentication required (uses orderId as lookup)
- Returns limited data only (no sensitive customer PII):
  - Service name
  - Shop name
  - Amount paid
  - Booking date and time
  - Order status
  - RCN rewards earned (if any)
- Validates the order exists and payment is completed
- Does NOT return customer wallet address, email, or phone

**File:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` or new controller

### 3. Create frontend standalone page

**New page:** `frontend/src/app/payment/success/page.tsx`

- Public page (no auth wrapper)
- Reads `orderId` and `session_id` from URL query params
- Calls `/api/services/orders/:orderId/payment-summary`
- Displays:
  - Success checkmark/animation
  - "Payment Successful!" heading
  - Order summary card (service, shop, amount, date/time)
  - RCN rewards earned message
  - "Download Receipt" button (optional, future)
  - Link to create a RepairCoin account or log in to view full order details
- Handles error states:
  - Order not found
  - Payment not completed
  - Invalid orderId

### 4. Update email template

**File:** `backend/src/services/EmailService.ts`

- Update the payment link email to mention that no login is required to pay
- Payment link itself doesn't change (Stripe handles it)

---

## Security Considerations

- The `/payment-summary` endpoint returns **limited data only** — no customer PII
- `orderId` is a UUID — not guessable, but still only shows non-sensitive order info
- Consider adding `session_id` verification: validate the Stripe session matches the order
- Rate limit the endpoint to prevent enumeration

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/app/payment/success/page.tsx` | **Create** — standalone success page |
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | **Modify** — update Stripe success_url, add payment-summary endpoint |
| `backend/src/domains/ServiceDomain/routes.ts` | **Modify** — register new public endpoint |
| `backend/src/services/EmailService.ts` | **Modify** — update payment link email copy (optional) |

---

## UI Design

```
┌─────────────────────────────────────────┐
│                                         │
│            ✅ Payment Successful!       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Service:    Triple Hair Cut    │    │
│  │  Shop:       Peanut Barbershop  │    │
│  │  Date:       Mar 24, 2026       │    │
│  │  Time:       2:00 PM            │    │
│  │  Amount:     $59.00             │    │
│  │  RCN Earned: +10 🪙             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Your appointment is confirmed.         │
│  A confirmation email has been sent.    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Log in to view full details   │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Payment link redirects to `/payment/success` instead of `/customer?tab=orders`
- [ ] Success page loads without authentication
- [ ] Order summary displays correct service, shop, amount, date/time
- [ ] Page works when a different customer is logged in (no conflict)
- [ ] Page works when no customer is logged in
- [ ] Page shows appropriate error for invalid/missing orderId
- [ ] Page shows appropriate message if payment is still pending
- [ ] Existing logged-in customer flow (direct booking) still works
- [ ] Rate limiting on payment-summary endpoint
- [ ] No customer PII exposed in payment-summary response
