# Bug: Seven shop email preference toggles are broken — 3 have orphaned methods, 4 have no implementation at all

**Status:** Open
**Priority:** High
**Est. Effort:** 1 hour (Option 1A — wire orphans) / 4-6 hours (Option 1B — build missing) / 20 minutes (Option 2)
**Created:** 2026-04-21
**Updated:** 2026-04-21 (expanded scope after BK-57E555 investigation)

---

## Problem

The Email Notifications settings page (`/shop?tab=settings` → Emails) exposes 12 shop-directed toggles. **Only 5 of them actually result in an email being sent.** The other 7 are broken in one of two ways:

### Class A — Orphaned methods (3 toggles)

The `EmailService` has a correctly-built method that accepts `shopId` and uses `sendEmailWithPreferenceCheck(..., 'key')`. But **no code in the backend ever calls that method.** A shop with the preference ON never receives the email because the trigger was never wired up.

| Toggle | UI label | Method defined | Caller |
|---|---|---|---|
| `newBooking` | New Booking | `sendNewBookingNotification` (`EmailService.ts:1795`) | **❌ none** |
| `customerReview` | Customer Review | `sendCustomerReviewNotification` (`EmailService.ts:~1840`) | **❌ none** |
| `paymentReceived` | Payment Received | `sendPaymentReceivedNotification` (`EmailService.ts:~1890`) | **❌ none** |

### Class B — No implementation at all (4 toggles)

The preference key exists in the UI, DB, and controller whitelist, but no `EmailService` method targets shop email with that preference key. Even if the trigger was wired, there would be nothing to call.

| Toggle | UI label | UI description | Shop-directed method |
|---|---|---|---|
| `bookingCancellation` | Booking Cancellation | "When a customer cancels their booking" | ❌ none |
| `bookingReschedule` | Booking Reschedule | "When a customer requests to reschedule" | ❌ none |
| `appointmentReminder` | Appointment Reminder | "24 hours before upcoming appointments" | ❌ none (reminder flow only sends to customers) |
| `noShowAlert` | No-Show Alert | "When a customer doesn't show up for appointment" | ❌ none |

### Class C — Actually working (5 toggles)

For reference, these are the toggles where a preference-gated shop-directed email is both implemented and triggered correctly:

| Toggle | Method | Caller |
|---|---|---|
| `newCustomer` | `sendNewCustomerNotification` | `PaymentService.ts:696` |
| `customerMessage` | `sendCustomerMessageNotification` | `MessageService.ts:226` |
| `refundProcessed` | `sendRefundProcessedNotification` | `PaymentService.ts:1303` |
| `subscriptionExpiring` | `sendPaymentReminder` | `ContractMonitoringService.ts:300` |
| `subscriptionExpiring` | `sendPaymentOverdue` | `SubscriptionEnforcementService.ts:285` |
| `subscriptionRenewal` | Shop-managed subscription reactivation — partial; the admin/shop variants (`sendSubscriptionReactivatedByAdmin`, `sendSubscriptionCancelledByShop`) are wired but their preference-gating path is worth re-verifying separately |

### User-visible impact

Shops see 12 toggles with clear descriptions, reasonably expect emails for each event, and receive emails for only 5 of them. The preferences UI silently lies about what it controls. Supporting tickets arrive like *"I toggled New Booking on but I'm not getting emails"* — and the answer today is *"the toggle doesn't actually do anything."*

The parent task doc `completed/bug-email-preferences-not-enforced.md` declared Class A as part of the "3 of 12 working" group — it wasn't verified end-to-end, only at the preference-check layer. Preference-gating was implemented correctly in those methods; the methods are just never called.

---

## Root Cause

Two distinct product-engineering oversights:

### Class A — methods built ahead of their triggers

During the "preference enforcement" sprint (commit `c2df9465`), three notification methods were created with the correct `sendEmailWithPreferenceCheck` pattern in anticipation of being wired into booking, review, and payment-completion flows. The wiring never landed. The methods sit in `EmailService` dead-lettered:

- `sendNewBookingNotification` — should fire when a customer's paid booking creates a new `service_orders` row for the shop (likely `PaymentService` on Stripe checkout success, or wherever an order transitions into `paid` status)
- `sendCustomerReviewNotification` — should fire when `ReviewController.createReview` (or equivalent) successfully inserts a review
- `sendPaymentReceivedNotification` — should fire when a payment settles for the shop (likely same Stripe webhook handler as Class A's new-booking trigger, possibly same call site, distinguished by event type)

Verified by exhaustive grep across `backend/src/` — zero call sites for each of the three methods. Only the method definitions appear.

### Class B — keys added to UI ahead of backend

The preference keys, DB columns, Zod types, and controller whitelist all exist. No `EmailService` method targets shop email with any of these four keys. Every method containing "Booking", "Cancel", "Reschedule", or "NoShow" sends to `data.customerEmail` (customer-directed), not to shop email.

`AppointmentReminderService.ts:695` gates email on `prefs.emailEnabled` which is the **customer's** `general_notification_preferences.email_enabled`, not the shop's `appointmentReminder` preference. No loop ever sends a reminder to the shop.

---

## Evidence

### Live test case — BK-57E555 (2026-04-20)

- Customer Qua Ting (`0x6cd036477d1c39da021095a62a32c6bb919993cf`) booked service at peanut, paid via Stripe, order `ord_cfa585ff-0aa2-49a5-a8bd-5c1acf57e555` created 2026-04-20 15:45:47
- Peanut shop email: `kyle.cagunot@mothergooseschools.org` (valid and verified)
- `shop_email_preferences.new_booking = true` for peanut in DB
- User expected: shop receives "New Booking" email
- Actual: no email received, no `sent_emails_log` row for peanut at any point — not just around the booking, but **ever**
- `sent_emails_log` has zero rows with `email_type = 'new_booking'` across all shops in the entire staging history — conclusive signal that `sendNewBookingNotification` has never run in production

### Code-level evidence

| File | Line | Observation |
|---|---|---|
| `frontend/src/components/shop/EmailSettings.tsx` | 205-208 | Four Class B toggles defined with shop-facing descriptions |
| `backend/src/services/EmailPreferencesService.ts` | 64-67, 222-225 | DB columns and TypeScript types for the four Class B keys exist |
| `backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts` | 162-165 | Valid-key whitelist includes all four Class B keys |
| `backend/src/services/EmailService.ts` | 1795, ~1840, ~1890 | Class A method definitions exist with correct `sendEmailWithPreferenceCheck` pattern |
| `backend/src/services/EmailService.ts` | — | **No method sends to a shop email address with any of the four Class B preference keys.** |
| `backend/src/services/EmailService.ts` | — | **Class A methods have zero callers in `backend/src/`.** Verified: `grep -rn sendNewBookingNotification backend/src/ --include="*.ts"` returns only the definition. Same for the other two. |
| `backend/src/services/AppointmentReminderService.ts` | 695 | Reminder dispatch checks customer prefs only; no loop ever sends a reminder to the shop |
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | 695-713 | Stripe checkout success flow calls `sendNewCustomerNotification` and `sendBookingConfirmation` (customer) only — does NOT call `sendNewBookingNotification` or `sendPaymentReceivedNotification` |

---

## Fix Required

Three options, stackable. Option 1A is recommended as an immediate quick win; 1B is the completionist path; Option 2 is a UI-truth band-aid if the team can't fit 1A/1B into this sprint.

### Option 1A — Wire the three orphaned methods (recommended minimum — ~1 hour)

The Class A methods are already written correctly. They just need to be called from the right trigger points.

**Trigger 1: `sendNewBookingNotification` — on service-order paid**

File: `backend/src/domains/ServiceDomain/services/PaymentService.ts`, inside the Stripe checkout success handler that currently lives around line 695-713.

After the order is marked paid and before/after `sendNewCustomerNotification`, call:

```ts
// Notify shop of the new booking. Preference-gated on 'newBooking'.
try {
  if (shop?.email) {
    await this.emailService.sendNewBookingNotification(
      shop.email,
      shop.shopId,
      {
        shopName: shop.name,
        customerName: customer?.name ?? customer?.email ?? 'Customer',
        serviceName: service?.name ?? 'Service',
        appointmentDate: order.bookingDate,
        appointmentTime: order.bookingTime ?? '',
        orderId: order.orderId,
        totalAmount: order.totalAmount,
      }
    );
  }
} catch (err) {
  logger.error('Failed to send new-booking email to shop (non-blocking)', { orderId: order.orderId, error: err });
}
```

Always wrapped in try/catch so an email failure doesn't roll back the booking.

**Trigger 2: `sendPaymentReceivedNotification` — on payment settled**

Same Stripe checkout success handler, but only for events that represent revenue to the shop (not free/100%-RCN-redemption orders, if those exist). Can share the same `if (shop?.email)` block as Trigger 1, or be placed inside the Stripe webhook handler at `backend/src/domains/shop/routes/webhooks.ts` if there's a cleaner separation between "order created" and "payment received" in the architecture.

```ts
try {
  if (shop?.email && order.totalAmount > 0) {
    await this.emailService.sendPaymentReceivedNotification(
      shop.email,
      shop.shopId,
      {
        shopName: shop.name,
        customerName: customer?.name ?? 'Customer',
        serviceName: service?.name ?? 'Service',
        amount: order.totalAmount,
        orderId: order.orderId,
        paymentMethod: 'Stripe',
        paidAt: new Date().toISOString(),
      }
    );
  }
} catch (err) {
  logger.error('Failed to send payment-received email to shop (non-blocking)', { orderId: order.orderId, error: err });
}
```

**Trigger 3: `sendCustomerReviewNotification` — on review created**

File: `backend/src/domains/ServiceDomain/controllers/ReviewController.ts` (or wherever review creation lives — grep for where rows are inserted into `service_reviews`). After successful review insertion:

```ts
try {
  const shop = await shopRepository.getShop(review.shopId);
  if (shop?.email) {
    await this.emailService.sendCustomerReviewNotification(
      shop.email,
      shop.shopId,
      {
        shopName: shop.name,
        customerName: review.customerName ?? 'A customer',
        rating: review.rating,
        reviewText: review.comment?.slice(0, 200) ?? '',
        serviceName: service?.name ?? 'Service',
        reviewId: review.id,
      }
    );
  }
} catch (err) {
  logger.error('Failed to send customer-review email to shop (non-blocking)', { reviewId: review.id, error: err });
}
```

All three calls go through `sendEmailWithPreferenceCheck` inside the method — so toggling the preference off correctly suppresses the email.

**Pros:** Smallest diff possible — three wire-ups, ~30 lines of new code. Closes three of the seven broken toggles. Zero new templates, zero migrations. Can ship in a day.

**Cons:** Doesn't address Class B. The remaining 4 toggles stay phantom until 1B ships.

### Option 1B — Build the four missing Class B emails (completionist — 4-6 hours)

Build the missing functionality so all 7 broken toggles start working. Same pattern as 1A: add one method per event, wire it into the existing trigger points.

**For each of the four Class B events, add a new method to `EmailService.ts`:**

```ts
async sendBookingCancelledToShop(data: {
  shopEmail: string;
  shopId: string;
  shopName: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  cancelledBy: 'customer' | 'shop' | 'system';
  cancelledAt: string;
  refundAmount?: number;
}): Promise<boolean> {
  const subject = `Booking cancelled — ${data.serviceName}`;
  const html = `...`;
  return this.sendEmailWithPreferenceCheck(
    data.shopEmail, subject, html, data.shopId, 'bookingCancellation'
  );
}

async sendRescheduleRequestToShop(data: {
  shopEmail: string;
  shopId: string;
  shopName: string;
  customerName: string;
  serviceName: string;
  currentDate: string;
  proposedDate: string;
  requestId: string;
}): Promise<boolean> {
  // ...
  return this.sendEmailWithPreferenceCheck(
    data.shopEmail, subject, html, data.shopId, 'bookingReschedule'
  );
}

async sendShopDailyAppointmentDigest(data: {
  shopEmail: string;
  shopId: string;
  shopName: string;
  appointments: Array<{ customerName: string; serviceName: string; time: string; orderId: string }>;
  date: string;  // tomorrow's date
}): Promise<boolean> {
  // Combined daily digest — one email per day, not one per appointment.
  // Better than N emails for shops with many bookings.
  // ...
  return this.sendEmailWithPreferenceCheck(
    data.shopEmail, subject, html, data.shopId, 'appointmentReminder'
  );
}

async sendNoShowMarkedToShop(data: {
  shopEmail: string;
  shopId: string;
  shopName: string;
  customerName: string;
  customerWallet: string;
  serviceName: string;
  appointmentDate: string;
  noShowCount: number;
  restrictionTriggered: boolean;
}): Promise<boolean> {
  // Confirmation + audit info for the shop, not a dunning email to the customer.
  // ...
  return this.sendEmailWithPreferenceCheck(
    data.shopEmail, subject, html, data.shopId, 'noShowAlert'
  );
}
```

**Wire each method into the existing trigger points:**

- `backend/src/domains/ServiceDomain/controllers/OrderController.ts:cancelOrder` — call `sendBookingCancelledToShop` after the customer cancellation email fires
- `backend/src/domains/ServiceDomain/controllers/OrderController.ts:requestReschedule` (or wherever reschedule requests originate) — call `sendRescheduleRequestToShop`
- `backend/src/services/AppointmentReminderService.ts` — add a new daily shop-digest scheduler (run once per day, e.g. 18:00 shop-local, querying next-day appointments per shop). Do **not** add a per-appointment shop email to the existing customer-reminder loop — shops with 20 bookings tomorrow should not receive 20 emails.
- `backend/src/domains/ServiceDomain/controllers/OrderController.ts:markNoShow` — call `sendNoShowMarkedToShop` after the no-show is recorded

All four calls MUST go through `sendEmailWithPreferenceCheck` so the preference toggle is honoured.

**Pros:** shops get all 12 promised notifications. UI and backend are fully aligned. Four new touchpoints that reduce no-shows, speed up rescheduling decisions, and improve shop awareness.

**Cons:** 4-6 hours of implementation + QA + 4 new email templates to design. Daily digest needs its own cron entry and timezone logic.

### Option 2 — Remove the 7 broken toggles from the UI (short-term band-aid — ~20 minutes)

Hide every toggle whose backend is broken until 1A/1B ship. Leave DB columns, controller whitelist, and Zod types alone.

**File:** `frontend/src/components/shop/EmailSettings.tsx` — remove the four Class B toggles (lines 205-208) **and** the three Class A toggles (the `newBooking`, `customerReview`, `paymentReceived` entries further up in the same list).

```diff
  {
    // Keep only toggles that actually work end-to-end:
    { key: "newCustomer" as const, ... },
    { key: "customerMessage" as const, ... },
    { key: "refundProcessed" as const, ... },
    { key: "subscriptionExpiring" as const, ... },
    { key: "subscriptionRenewal" as const, ... },
-   { key: "newBooking" as const, label: "New Booking", description: "When a customer books a service" },
-   { key: "customerReview" as const, label: "Customer Review", description: "When a customer leaves a review" },
-   { key: "paymentReceived" as const, label: "Payment Received", description: "When you receive a payment" },
-   { key: "bookingCancellation" as const, label: "Booking Cancellation", description: "When a customer cancels their booking" },
-   { key: "bookingReschedule" as const, label: "Booking Reschedule", description: "When a customer requests to reschedule" },
-   { key: "appointmentReminder" as const, label: "Appointment Reminder", description: "24 hours before upcoming appointments" },
-   { key: "noShowAlert" as const, label: "No-Show Alert", description: "When a customer doesn't show up for appointment" },
  }
```

No backend changes. No migrations. DB rows and preference values stay put — they just aren't editable from the UI.

**Pros:** ~20-minute change. Makes the UI truthful immediately. Zero risk of regression.

**Cons:** Shops lose control surface for 7 of 12 notification types. For the Class A trio especially, shops may have previously thought they could opt out of New Booking emails — removing the toggle doesn't regress any real behaviour (no emails were firing anyway), but it's a UX reduction. Mild DB-smell of dormant columns.

### Recommended path

**Ship Option 1A this sprint. Ship Option 1B next sprint. Skip Option 2.**

Option 1A is so small (three wire-ups, no new templates, no migrations) that it's cheaper than Option 2 and directly adds real value. Class A methods are already built — all that's missing is three function calls. Shops will immediately start receiving the three most important notifications (new booking, payment, review).

Option 1B is a proper feature build for the remaining four — worth doing but not release-blocking.

Option 2 makes sense only if the team cannot spare the day for Option 1A this sprint.

---

## Files to Modify

### Option 1A (recommended — wire orphaned methods)

| File | Action |
|------|--------|
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | Inside the Stripe checkout success handler (~line 695-713), add calls to `sendNewBookingNotification` and `sendPaymentReceivedNotification`. Wrap in try/catch. |
| `backend/src/domains/ServiceDomain/controllers/ReviewController.ts` | After successful review insert, call `sendCustomerReviewNotification`. Wrap in try/catch. |

### Option 1B (add on top of 1A — build missing)

| File | Action |
|------|--------|
| `backend/src/services/EmailService.ts` | Add four new methods: `sendBookingCancelledToShop`, `sendRescheduleRequestToShop`, `sendShopDailyAppointmentDigest`, `sendNoShowMarkedToShop`. Each uses `sendEmailWithPreferenceCheck` with the appropriate key. |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Invoke the new cancel/reschedule/no-show methods after the corresponding customer-facing emails fire. Guard each in try/catch. |
| `backend/src/services/AppointmentReminderService.ts` | Add `sendDailyShopDigests()` method + register in the cron/scheduler config. |
| `backend/src/scripts/scheduler.ts` (or equivalent) | Add the new daily shop-digest schedule. |
| Email template files (4 new) | Shop-facing HTML templates for each of the four Class B events. |

### Option 2 (UI removal only — not recommended if 1A is viable)

| File | Action |
|------|--------|
| `frontend/src/components/shop/EmailSettings.tsx` | Remove the 7 broken toggles (3 Class A + 4 Class B). Leave remaining 5 toggles untouched. |

---

## Verification Checklist

### Option 1A — wire orphaned methods

- [ ] **New Booking:** toggle `newBooking` ON for a test shop. As a customer, book and pay for a service at that shop. Confirm shop receives the "New Booking" email within ~30s, with customer name, service, appointment time, order ID.
- [ ] **New Booking — toggle OFF:** repeat with `newBooking` OFF. Confirm no email. Preference gate verified.
- [ ] **Payment Received:** toggle `paymentReceived` ON. Trigger a paid booking. Confirm shop receives the "Payment Received" email with amount. Toggle OFF — no email.
- [ ] **Customer Review:** toggle `customerReview` ON. As a customer with a completed booking, submit a review. Confirm shop receives the "New Review" email with rating + comment preview. Toggle OFF — no email.
- [ ] **Log verification:** after the above tests, query `sent_emails_log` and confirm rows appear with `email_type` matching the new wire-ups. The "0 rows ever" signal from the BK-57E555 investigation should transition to "N rows" post-fix.
- [ ] **Failure isolation:** simulate email provider outage (block SMTP or misconfigure provider key in staging). Trigger a booking. Confirm the booking itself still succeeds; only the email fails. Server logs the error but doesn't roll back the order.

### Option 1B — build missing

- [ ] **Booking Cancellation:** toggle on, cancel a booking, confirm shop receives email mentioning customer name, service, and appointment time. Toggle off, cancel another booking, confirm no email.
- [ ] **Booking Reschedule:** toggle on, customer requests reschedule, confirm shop receives email with current + proposed times and a CTA to the reschedule request. Toggle off, confirm no email.
- [ ] **Appointment Reminder:** toggle on, wait for next daily-digest run, confirm shop receives a single email listing tomorrow's appointments. Shop with 0 appointments tomorrow receives no email. Shop with 10 appointments receives exactly one email, not 10. Toggle off, confirm no email regardless of appointment count.
- [ ] **No-Show Alert:** toggle on, mark a customer as no-show, confirm shop receives a confirmation email with cumulative no-show count and restriction-tier status. Toggle off, confirm no email.

### Option 2 — UI removal

- [ ] `/shop?tab=settings` → Emails renders only the 5 working toggles. The 7 broken ones are hidden.
- [ ] Remaining toggles still save and load correctly.
- [ ] No DB migration run; existing rows with the 7 hidden-key columns are unaffected.
- [ ] Backend endpoint still accepts payloads with the 7 hidden keys (controller whitelist unchanged), so legacy clients don't break.

### Cross-cutting regression (applies to all options)

- [ ] The 5 working toggles (`newCustomer`, `customerMessage`, `refundProcessed`, `subscriptionExpiring`, `subscriptionRenewal`) still work as expected.
- [ ] Customer-facing emails (booking confirmations, cancellation notices to customers, no-show warnings to customers, customer appointment reminders) still send regardless of any shop preference state.
- [ ] Preferences persist across page refresh and cross-device.

---

## Notes

- **Correction to prior close-out:** the parent task `completed/bug-email-preferences-not-enforced.md` declared "3 of 12 working" and listed `newBooking`, `customerReview`, `paymentReceived` as those three. Verified by call-site audit 2026-04-21: those methods are NEVER called. The parent task's preference-check implementation was correct; the verification was not carried to end-to-end coverage, so the orphan-method bug was not detected. The parent task can remain Completed for the scope it actually addressed (preference-gating wiring in existing methods); this doc captures the orphan-wiring and missing-method gaps that were outside its scope.
- **Relation to prior docs:**
  - `completed/bug-email-preferences-not-enforced.md` — preference enforcement correct, but end-to-end coverage missed the never-called methods.
  - `bugs/15-04-2026/bug-email-preferences-not-enforced.md` — same topic under a different path.
  - `test/qa-email-notifications-test-guide.md` — QA guide; Section 5 correctly documents the 4 Class B toggles as phantom. Needs an update to also flag the 3 Class A toggles (New Booking, Customer Review, Payment Received) as "no email in either state" so testers can distinguish "bug still present" from "fix has shipped."
- **Priority bumped to High** (from Medium on the original 4-toggle version of this doc) because 7 of 12 shop notification toggles not working is more than half the feature. Visible UX trust hit — shops toggling preferences and getting nothing. Upgrade to Critical if retention analytics show shops rely on these notifications.
- **Why preference-gating didn't catch this:** `sendEmailWithPreferenceCheck` only runs when called. A method that is never called never hits its preference check, so a "preference enforcement" audit that looks only at the send path misses orphaned methods. Future audits should trace *backward* from the preference-keyed methods to confirm at least one live call site exists for each.
- **Daily digest vs per-event (for appointmentReminder):** chose daily digest deliberately in Option 1B. Per-appointment reminders to a shop with many bookings = inbox spam; daily digest = single scannable touchpoint. If product prefers per-appointment, change the design but keep the preference-check pattern.
- **Data-model note:** DB schema already has all 12 columns. No migration needed for Options 1A or 1B. For Option 2, leave the columns alone.
- **Cron for daily digest (Option 1B):** shops span multiple timezones in production. Simplest first pass: one UTC-anchored digest run per day (e.g. 22:00 UTC), with the "tomorrow" window computed per shop's configured timezone. Log a warning for shops without a timezone setting and fall back to UTC.
- **Out of scope for this task:**
  - Audit other notification surfaces (in-app, push, SMS) for similar phantom toggles or orphan methods. Same failure mode is plausible elsewhere.
  - Analytics on which toggles shops flip on/off — would inform whether Class B is worth Option 1B at all, or whether Option 2 for the Class B subset is fine forever.
  - Re-verify `subscriptionRenewal` end-to-end (partially wired in the table above; needs closer inspection).
