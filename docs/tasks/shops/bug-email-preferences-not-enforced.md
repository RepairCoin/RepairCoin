# Bug: Email Notification Preferences Not Enforced for Most Notification Types

## Status: Fixed (2026-04-07) — Phase 1-4 Complete
## Priority: Medium
## Date: 2026-03-25
## Category: Bug - Notifications
## Current State: All 12 toggles with email implementations now enforce preferences

---

## Overview

The Email Notifications settings page (`/shop?tab=settings` → Emails) allows shops to toggle 12+ notification types on/off. The preferences are correctly saved to the database and loaded on the frontend. However, only 3 notification types actually check the preference before sending — the rest bypass preferences entirely and always send.

**Impact:** Shops that disable notifications still receive them, creating a false sense of control. This is a trust/UX issue.

---

## Current State

### Working (3 of 12)

| UI Toggle | Email Method | Preference Key |
|-----------|-------------|----------------|
| New Booking | `sendNewBookingNotification()` | `newBooking` |
| Customer Review | `sendCustomerReviewNotification()` | `customerReview` |
| Payment Received | `sendPaymentReceivedNotification()` | `paymentReceived` |

These three call `sendEmailWithPreferenceCheck()` which queries `shouldSendNotification()` before sending.

### Not Working (9 of 12)

| UI Toggle | Preference Key | Email Method | Issue |
|-----------|---------------|-------------|-------|
| Booking Cancellation | `bookingCancellation` | `sendBookingCancelledByShop()` / `sendBookingCancelledByCustomer()` | Calls `sendEmail()` directly |
| Booking Reschedule | `bookingReschedule` | `sendAppointmentRescheduledByShop()` | Calls `sendEmail()` directly |
| Appointment Reminder | `appointmentReminder` | `AppointmentReminderService` | Separate service, never checks preferences |
| No-Show Alert | `noShowAlert` | `sendNoShowTier1Warning()` through `sendNoShowTier4Suspended()` | Calls `sendEmail()` directly |
| New Customer | `newCustomer` | None | No email method exists |
| Customer Message | `customerMessage` | None | No email method exists |
| Refund Processed | `refundProcessed` | None | No email method exists |
| Subscription Renewal | `subscriptionRenewal` | `sendSubscriptionReactivated()` | Calls `sendEmail()` directly |
| Subscription Expiring | `subscriptionExpiring` | `sendPaymentReminder()` / `sendPaymentOverdue()` | Calls `sendEmail()` directly |

---

## Root Cause

The `EmailService` has a `sendEmailWithPreferenceCheck()` wrapper method (line 1930) that checks shop preferences before sending. However, only the 3 newest email methods use it. All older methods call `this.sendEmail()` directly, bypassing the preference check.

**File:** `backend/src/services/EmailService.ts`

```typescript
// Working pattern (only 3 methods use this):
return this.sendEmailWithPreferenceCheck(shopEmail, subject, html, shopId, 'newBooking');

// Broken pattern (all other methods use this):
return this.sendEmail(data.shopEmail, subject, html);
```

---

## Additional Issue: Debug Logs

`EmailPreferencesService.ts` and `EmailPreferencesController.ts` contain debug `console.log` statements that should be removed:

```typescript
// EmailPreferencesService.ts
console.log('📧 [EmailPreferencesService] getShopPreferences called for shopId:', shopId);
console.log('📧 [EmailPreferencesService] Executing query...');
console.log('📧 [EmailPreferencesService] Query result rows:', result.rows.length);

// EmailPreferencesController.ts
console.log('📧 [EmailPreferences] GET /shops/:shopId/email-preferences called');
console.log('📧 [EmailPreferences] Shop ID:', shopId);
```

---

## Implementation Plan

### Phase 1: Fix Existing Email Methods

Update each email method that sends to shops to use `sendEmailWithPreferenceCheck()` instead of `sendEmail()`.

**Methods to update in `EmailService.ts`:**

```typescript
// Booking Cancellation (shop notification)
// Change: this.sendEmail(shopEmail, subject, html)
// To: this.sendEmailWithPreferenceCheck(shopEmail, subject, html, shopId, 'bookingCancellation')

// Booking Reschedule (shop notification)
// sendAppointmentRescheduledByShop → 'bookingReschedule'

// No-Show alerts (shop notifications)
// sendNoShowTier1Warning through sendNoShowTier4Suspended → 'noShowAlert'

// Subscription emails
// sendSubscriptionReactivated → 'subscriptionRenewal'
// sendPaymentReminder / sendPaymentOverdue → 'subscriptionExpiring'
```

**Important:** Only shop-directed emails should check preferences. Customer-directed emails (booking confirmations, receipts) should always send — customers don't have preference settings.

### Phase 2: Fix AppointmentReminderService

**File:** `backend/src/services/AppointmentReminderService.ts`

This service sends reminder emails independently via a scheduler. It needs to:
1. Import `EmailPreferencesService`
2. Call `shouldSendNotification(shopId, 'appointmentReminder')` before sending shop reminders

### Phase 3: Implement Missing Notification Types

These preference keys exist in the UI but have no corresponding email implementation:

| Preference | Implementation Needed |
|-----------|----------------------|
| `newCustomer` | Send email when a first-time customer books at the shop |
| `customerMessage` | Send email when customer sends a message (check if NotificationDomain handles this) |
| `refundProcessed` | Send email when a refund is issued to a customer |

**Decision needed:** Should these be implemented as emails, or should the toggles be removed from the UI until they're implemented?

### Phase 4: Clean Up Debug Logs

Remove all `console.log` debug statements from:
- `backend/src/services/EmailPreferencesService.ts` (lines 57, 90, 92, 95, 102)
- `backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts` (lines 18, 21, 26, 29, 33, 36, 52, 55, 57)

---

## Method Signature Reference

The `sendEmailWithPreferenceCheck` method requires `shopId` as a parameter. Some existing email methods don't receive `shopId` — they'll need their call sites updated to pass it.

```typescript
private async sendEmailWithPreferenceCheck(
  to: string,
  subject: string,
  html: string,
  shopId: string,
  notificationType: keyof Omit<EmailPreferences, 'shopId' | 'digestTime' | ...>
): Promise<boolean>
```

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/services/EmailService.ts` | Update ~9 methods to use `sendEmailWithPreferenceCheck` |
| `backend/src/services/AppointmentReminderService.ts` | Add preference check before sending |
| `backend/src/services/EmailPreferencesService.ts` | Remove debug console.logs |
| `backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts` | Remove debug console.logs |
| `frontend/src/services/api/emailPreferences.ts` | Remove debug console.logs |

---

## Verification Checklist

- [ ] Toggle off "New Booking" → no email sent on new booking
- [ ] Toggle off "Booking Cancellation" → no email sent on cancellation
- [ ] Toggle off "Booking Reschedule" → no email sent on reschedule
- [ ] Toggle off "Appointment Reminder" → no reminder email 24h before
- [ ] Toggle off "No-Show Alert" → no email on no-show marking
- [ ] Toggle off "Customer Review" → no email on new review
- [ ] Toggle off "Payment Received" → no email on payment
- [ ] Toggle off "Subscription Renewal" → no email on renewal
- [ ] Toggle off "Subscription Expiring" → no email on expiring
- [ ] Customer-directed emails still send regardless of shop preferences
- [ ] Debug console.logs removed from all preference-related files
- [ ] Preferences persist across page refreshes
- [ ] Default preferences created for new shops
