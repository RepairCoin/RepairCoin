# Send Link Email Not Working for Manual Bookings

## Status: 🔲 TODO

**Priority:** High
**Area:** Backend / Frontend - Shop Appointments Manual Booking
**Reported:** March 4, 2026
**Related:** `docs/tasks/strategy/shop-manual-appointment-booking.md`

---

## Problem Statement

When a shop admin creates a manual booking using the "Send Link" payment option, the customer does not receive the payment link email. The booking is created successfully and a Stripe session is generated, but the email delivery has no feedback — no error shown to the shop admin if the email fails.

### Reproduction
1. Go to Shop → Appointments tab
2. Click to create a manual booking
3. Select a customer (e.g., `basistabasisig2@gmail.com` / `0x150e4A7bCF6204BEbe0EFe08fE7479f2eE30A24e`)
4. Select "Send Link" payment option
5. Complete the booking
6. Customer never receives the payment link email

---

## Investigation Findings

### 1. Order Not Found for Reported Customer

Database query shows **no manual booking** for `0x150e4a...` today. The only manual booking is for Lee Ann (`0x960aa...`):

```
order_id: 232e1ac0-6620-4226-9141-54de8d1510bb
customer: 0x960aa947468cfd80b8e275c61abce19e13d6a9e3 (Lee Ann)
email: ac_baniqued@yahoo.com
status: pending / pending
booking_type: manual
stripe_session_id: cs_test_a1ik5nGb1UWg... (set)
notes: "see the link"
```

**Possible explanations:**
- User selected the wrong customer (Lee Ann instead of `0x150e4a...`)
- A second booking attempt for `0x150e4a...` failed due to **time slot conflict** (409) with Lee Ann's existing booking at the same slot
- Either way, the email went to `ac_baniqued@yahoo.com`, not `basistabasisig2@gmail.com`

### 2. Silent Error Swallowing (3 Layers)

The email sending has a 3-layer error suppression chain:

**Layer 1 — `EmailService.sendEmail()` (line 1788-1796):**
```typescript
} catch (error: any) {
  logger.error('Failed to send email:', {...});
  return false;  // Returns false instead of throwing
}
```

**Layer 2 — `ManualBookingController` send_link block (line 319-323):**
```typescript
} catch (stripeError: any) {
  console.error('Error creating payment link:', stripeError);
  // Continue with booking even if payment link fails
}
```
This wraps BOTH the Stripe session creation AND the email send. If either fails, the booking still returns success.

**Layer 3 — `sendPaymentLinkEmail` return value ignored (line 305):**
```typescript
await emailService.sendPaymentLinkEmail(
  customerEmail,
  customerData.name || 'Customer',
  { ... }
);
// Return value (boolean) never checked!
```

### 3. No Email Status in API Response

The response at line 368-391 includes `paymentLink` but does NOT indicate whether the email was sent:
```typescript
res.status(201).json({
  success: true,
  booking: {
    // ... booking details
    paymentLink: paymentLinkUrl  // Payment link URL but no emailSent field
  }
});
```

### 4. Email Configuration is Valid

Email env vars are properly configured:
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_USER=itpahilgadev@gmail.com`
- `EMAIL_PASS=***` (set)
- `EMAIL_FROM=RepairCoin <noreply@repaircoin.com>`

SMTP credentials were verified working in a previous investigation.

### 5. Email FROM Address Mismatch

`EMAIL_FROM` is `noreply@repaircoin.com` but authenticated as `itpahilgadev@gmail.com`. Gmail typically overrides the From header, but this could affect deliverability (SPF/DKIM checks by recipient's mail server may flag it).

---

## Root Cause

**Primary: `toFixed()` crash on string amount** — The `price_usd` column in PostgreSQL is type `numeric`, which `node-postgres` returns as a **string** (e.g., `"25.00"`). The `sendPaymentLinkEmail` template calls `data.amount.toFixed(2)` which throws `TypeError: toFixed is not a function` on a string. This exception is caught silently, so the payment link email is never sent. The confirmation email (`sendAppointmentConfirmation`) works because it doesn't call `.toFixed()`.

**Secondary:** The entire Stripe+email block was wrapped in a single try/catch that silently continued. The `sendPaymentLinkEmail` return value was ignored. No "email sent" indicator in the API response or frontend UI.

---

## Proposed Fix

### Fix 1: Add email send status to API response and log it

**File:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts`

```typescript
// Track email status
let emailSent = false;

// In the send_link block (line 304-317):
if (paymentStatus === 'send_link' && customerEmail) {
  const emailResult = await emailService.sendPaymentLinkEmail(
    customerEmail,
    customerData.name || 'Customer',
    { ... }
  );
  emailSent = emailResult;
  if (!emailResult) {
    console.error('Payment link email failed to send to:', customerEmail);
  } else {
    console.log('Payment link email sent to:', customerEmail);
  }
}

// In the response (line 368+):
res.status(201).json({
  success: true,
  booking: {
    // ... existing fields
    paymentLink: paymentLinkUrl,
    emailSent: emailSent,  // NEW
  }
});
```

### Fix 2: Show email status toast on frontend

**File:** `frontend/src/components/shop/ManualBookingModal.tsx`

```typescript
// After createManualBooking response (line 339-342):
if (paymentStatus === 'send_link') {
  if (response.emailSent) {
    toast.success(`Payment link sent to ${bookingData.customerEmail}`);
  } else {
    toast.warning('Booking created but email failed to send. Copy the payment link manually.');
  }
}
```

### Fix 3: Separate Stripe error handling from email error handling

**File:** `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts`

Currently Stripe session creation and email sending share the same try/catch (lines 267-323). They should be separate:

```typescript
// Stripe session creation
try {
  const session = await getStripe().checkout.sessions.create({...});
  paymentLinkUrl = session.url;
  await pool.query(`UPDATE service_orders SET stripe_session_id = $1 ...`);
} catch (stripeError) {
  console.error('Error creating Stripe session:', stripeError);
}

// Email sending (separate try/catch)
if (paymentStatus === 'send_link' && customerEmail && paymentLinkUrl) {
  try {
    emailSent = await emailService.sendPaymentLinkEmail(customerEmail, ...);
  } catch (emailError) {
    console.error('Error sending payment link email:', emailError);
  }
}
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | Check email return value, add `emailSent` to response, separate error handling |
| `frontend/src/components/shop/ManualBookingModal.tsx` | Show toast for email send status |
| `frontend/src/services/api/appointments.ts` | Add `emailSent` to `ManualBookingResponse` interface |

---

## Testing

1. Create a manual booking with "Send Link" for a customer with valid email
2. Verify email arrives at customer's inbox
3. Verify `emailSent: true` in API response
4. Verify frontend shows success toast with email address
5. Test with customer without email — should show warning toast
6. Test with invalid email — should show warning about email failure
7. Test with Stripe misconfigured — booking should still be created
8. Verify the payment link in the email works correctly
