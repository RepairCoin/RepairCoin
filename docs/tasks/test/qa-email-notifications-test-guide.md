# QA Test Guide: Shop Email Notifications

## Date: 2026-04-21
## Feature: /shop?tab=settings → Emails (Email Notification Preferences)
## Category: Comprehensive QA Guide

---

## Feature Overview

The Email Notifications settings page lets shops toggle which events trigger an email to the shop's registered address. Preferences are persisted per shop in the `email_preferences` table, loaded on page render, and checked server-side before each shop-directed email is sent via `EmailService.sendEmailWithPreferenceCheck(...)`.

Customer-facing emails (booking confirmations, cancellation notices to customers, reminders to customers, no-show warnings to customers) are NOT gated by shop preferences and always send.

---

## Current State Snapshot (as of 2026-04-21)

Before running the suite, understand which toggles are wired to real emails and which are currently phantom (tracked in `bugs/21-04-2026/bug-shop-email-toggles-without-backing-emails.md`):

| Toggle | Shop-directed email exists? | Preference gate in place? |
|---|---|---|
| New Booking | Yes | Yes |
| Customer Review | Yes | Yes |
| Payment Received | Yes | Yes |
| New Customer | Yes | Yes |
| Customer Message | Yes | Yes |
| Refund Processed | Yes | Yes |
| Subscription Renewal | Yes | Yes |
| Subscription Expiring | Yes | Yes (3 triggers: reminder, overdue 1st, overdue 2nd) |
| Booking Cancellation | **No** | N/A (phantom) |
| Booking Reschedule | **No** | N/A (phantom) |
| Appointment Reminder | **No** for shop (customer reminder exists separately) | N/A (phantom) |
| No-Show Alert | **No** | N/A (phantom) |

Sections 3 and 4 below cover the working toggles. Section 5 documents expected phantom-toggle behaviour so QA can explicitly note "bug still present" rather than marking a test as pass/fail.

---

## Test Setup

### Required test accounts

- **Shop A:** a verified shop with active subscription, valid email, at least one customer with bookings. Example on staging: `peanut`.
- **Shop B:** a second shop with a different email address, used for cross-contamination checks.
- **Customer A:** a customer with Shop A as home shop, at least one pending/paid booking. Example: Qua Ting (`0x6cd036477d1c39da021095a62a32c6bb919993cf`) at peanut.
- **Customer B:** a fresh (never-booked) customer for new-customer flow tests.

### Environment prep

- Inbox access for Shop A's email (or a mail-catcher in staging). Gmail + filter on sender domain is fine.
- Staging DB access (for direct verification of `email_preferences` table and per-email side effects).
- Ability to trigger each business event (admin can create bookings, mark completions, process refunds, etc.).

### Baseline before each section

Reset Shop A's preferences to the default (all ON) before each section:

```sql
UPDATE email_preferences
SET
  new_booking = true, booking_cancellation = true, booking_reschedule = true,
  appointment_reminder = true, no_show_alert = true, customer_review = true,
  payment_received = true, subscription_renewal = true, subscription_expiring = true,
  new_customer = true, customer_message = true, refund_processed = true
WHERE shop_id = '<shop_a_id>';
```

---

## Section 1: Preference UI — Persistence & Defaults

### Test 1.1: Defaults for a new shop

1. Create a brand-new shop via admin (or observe first login of a newly-registered shop).
2. Navigate to `/shop?tab=settings` → Emails tab.
3. **Expected:** All 12 toggles render, all in the ON state.
4. **Expected:** A default row exists in `email_preferences` with all boolean columns `true`.

### Test 1.2: Save and reload a single toggle

1. Toggle "New Booking" from ON to OFF.
2. **Expected:** Toast "Email preferences saved" (or equivalent success indicator).
3. Refresh the page.
4. **Expected:** New Booking is still OFF. Other toggles unchanged.

### Test 1.3: Batch-save multiple toggles

1. Toggle OFF: New Booking, Customer Review, Payment Received.
2. **Expected:** Single save round-trip, no duplicate network requests per toggle (inspect network tab).
3. Navigate away to another tab, return to Emails.
4. **Expected:** All three remain OFF.

### Test 1.4: Cross-shop isolation

1. As Shop A, toggle OFF New Booking.
2. Log out, log in as Shop B.
3. Open Emails tab.
4. **Expected:** Shop B's New Booking is still ON — Shop A's change did not leak.

### Test 1.5: Unauthenticated access

1. Log out. Attempt to hit `GET /api/shops/:shopId/email-preferences` directly with curl or browser (no auth header).
2. **Expected:** 401 Unauthorized.

### Test 1.6: Wrong-shop access

1. Log in as Shop A. Attempt to hit `GET /api/shops/<Shop B's id>/email-preferences`.
2. **Expected:** 403 Forbidden (or equivalent). Shop A should never see Shop B's preferences.

---

## Section 2: Global Email Settings

### Test 2.1: Master email switch

Context: there's typically a master "Enable email notifications" toggle or `email_enabled` flag that supersedes individual preferences.

1. Master ON + all individual toggles ON → emails should fire normally.
2. Master OFF + all individual toggles ON → no emails fire for any event.
3. Master ON + individual toggle OFF → that specific event suppresses, others still fire.
4. **Expected:** Master OFF behaves as a blanket kill switch.

### Test 2.2: Quiet hours

1. Enable quiet hours for 22:00-08:00 shop-local.
2. Trigger a new-booking event at 23:00 shop-local.
3. **Expected:** Behaviour per product spec — either (a) email held/queued until quiet hours end, (b) email sent anyway with a lower-priority flag, or (c) email suppressed entirely. Whichever the spec says; document the actual behaviour.
4. Same test at 10:00 shop-local → email sends normally.

---

## Section 3: Shop-Directed Emails (Working Toggles)

Each test below follows the same pattern: toggle OFF, trigger the event, verify no email; toggle ON, trigger again, verify email.

### Test 3.1: New Booking (`newBooking`)

1. Toggle New Booking OFF.
2. As Customer A, book any available service at Shop A via the marketplace.
3. **Expected:** No email to Shop A. Booking succeeds. Customer still receives their confirmation.
4. Toggle New Booking ON.
5. Book another service at Shop A.
6. **Expected:** Shop A receives "New Booking" email within ~30 seconds, containing customer name, service, appointment time, order ID.

### Test 3.2: Customer Review (`customerReview`)

1. Have Customer A complete a booking at Shop A.
2. Toggle Customer Review OFF.
3. Submit a review from Customer A's account.
4. **Expected:** No email to Shop A.
5. Toggle Customer Review ON. Submit a second review (or edit the first to resubmit).
6. **Expected:** Shop A receives "New Review" email with rating, comment snippet, and link to respond.

### Test 3.3: Payment Received (`paymentReceived`)

1. Toggle Payment Received OFF.
2. Customer A completes a Stripe payment for a new booking.
3. **Expected:** No email to Shop A about the payment.
4. Toggle Payment Received ON. Customer A pays for another booking.
5. **Expected:** Shop A receives "Payment Received" email with amount, booking details, net after fees if applicable.

### Test 3.4: New Customer (`newCustomer`)

1. Toggle New Customer OFF.
2. As Customer B (fresh, no prior Shop A bookings), complete first booking at Shop A.
3. **Expected:** No email to Shop A despite this being a first-time customer.
4. Toggle New Customer ON.
5. Create another fresh customer and complete first booking at Shop A.
6. **Expected:** Shop A receives "New Customer" email with the customer's display name, wallet, and the service booked.

### Test 3.5: Customer Message (`customerMessage`)

1. Toggle Customer Message OFF.
2. As Customer A, open messaging with Shop A and send a test message.
3. **Expected:** No email to Shop A (in-app notification still fires per its own preference).
4. Toggle Customer Message ON. Send another message.
5. **Expected:** Shop A receives "New Message" email with message preview and link to the conversation.

### Test 3.6: Refund Processed (`refundProcessed`)

1. Set up a Shop A booking that has been refunded (admin or standard refund flow).
2. Toggle Refund Processed OFF, trigger another refund.
3. **Expected:** No email to Shop A.
4. Toggle Refund Processed ON, trigger a third refund.
5. **Expected:** Shop A receives "Refund Processed" email with amount, original order, reason.

### Test 3.7: Subscription Renewal (`subscriptionRenewal`)

1. Ensure Shop A's subscription is set to auto-renew imminently (or simulate via admin/Stripe test-clock).
2. Toggle Subscription Renewal OFF. Let renewal fire.
3. **Expected:** No email to Shop A confirming renewal. Subscription still renews successfully.
4. Toggle ON. Cause another renewal.
5. **Expected:** Shop A receives "Subscription Renewed" email.

### Test 3.8: Subscription Expiring (`subscriptionExpiring`)

This preference key gates three distinct email triggers — test all three.

**3.8a — Pre-expiry reminder:**

1. Shop A's subscription set to expire in ~3 days (simulate via admin or Stripe test-clock).
2. Toggle Subscription Expiring OFF. Let the reminder-dispatch scheduler run.
3. **Expected:** No reminder email.
4. Toggle ON. Re-trigger reminder (or roll forward to next scheduled send).
5. **Expected:** "Subscription expiring soon" email.

**3.8b — First overdue notice:**

1. Let Shop A's subscription lapse into overdue state (1 day past).
2. Toggle Subscription Expiring OFF.
3. Run the overdue-reminder dispatcher.
4. **Expected:** No email.
5. Toggle ON. Re-dispatch.
6. **Expected:** "Payment overdue" first-reminder email.

**3.8c — Second overdue / final notice:**

1. Same setup but 7+ days overdue.
2. Repeat OFF/ON pattern, verify the final-notice email respects the toggle.

---

## Section 4: Regression — Working Emails Unaffected by Phantom-Toggle Changes

### Test 4.1: Phantom toggles don't affect real toggles

1. Set the 4 phantom toggles (Booking Cancellation, Booking Reschedule, Appointment Reminder, No-Show Alert) to various combinations of ON/OFF.
2. Verify Tests 3.1-3.8 still behave correctly.
3. **Expected:** The phantom toggles have no effect on any real email's send/suppress decision, regardless of their state. The real toggles alone gate real emails.

### Test 4.2: DB schema not corrupted when saving phantom toggles

1. Toggle all 4 phantom toggles OFF via UI.
2. Query `SELECT * FROM email_preferences WHERE shop_id = '<shop_a_id>'`.
3. **Expected:** The four phantom columns (`booking_cancellation`, `booking_reschedule`, `appointment_reminder`, `no_show_alert`) are `false` in the DB. Other columns untouched.
4. Toggle them back ON. Re-query.
5. **Expected:** All four columns flip to `true`. No other columns affected.

---

## Section 5: Phantom Toggles — Expected "No-Op" Behaviour

**Important:** until `bugs/21-04-2026/bug-shop-email-toggles-without-backing-emails.md` is resolved (either Option 1 implements the emails, or Option 2 removes the toggles), these four tests should document that **no email sends in either toggle state**, because no shop-directed email exists for these events.

These tests exist so QA can identify whether the bug is still present (no email in either state = phantom) vs whether the fix has shipped (email gating behaves like Section 3 tests).

### Test 5.1: Booking Cancellation (`bookingCancellation`)

1. Toggle ON. Have Customer A cancel a booking at Shop A.
2. **Expected (current/buggy):** Shop A receives NO email. Customer does receive their customer-facing cancellation confirmation (separate email, always sends).
3. Toggle OFF. Repeat.
4. **Expected (current/buggy):** Identical behaviour — no shop email in either state.
5. **Expected after Option 1 fix:** ON → shop email arrives; OFF → no shop email.

### Test 5.2: Booking Reschedule (`bookingReschedule`)

1. Toggle ON. Customer A submits a reschedule request for an upcoming Shop A booking.
2. **Expected (current/buggy):** Shop A gets no email. They must notice the pending request via the dashboard.
3. Toggle OFF. Another reschedule request.
4. **Expected (current/buggy):** Same — no shop email regardless.

### Test 5.3: Appointment Reminder (`appointmentReminder`)

1. Shop A has bookings scheduled for tomorrow.
2. Toggle ON. Let the reminder dispatcher run (typically previous-day evening).
3. **Expected (current/buggy):** Customers with bookings tomorrow receive reminder emails (gated on the customer's own `emailEnabled` preference). Shop A receives NO reminder email / digest.
4. Toggle OFF. Repeat.
5. **Expected (current/buggy):** Customer reminders still fire. Shop still receives nothing.
6. **Expected after Option 1 fix:** ON → shop receives a single daily digest of tomorrow's appointments; OFF → no shop digest.

### Test 5.4: No-Show Alert (`noShowAlert`)

1. Toggle ON. Mark Customer A as no-show for a past booking at Shop A.
2. **Expected (current/buggy):** Customer A receives the no-show tier warning email (customer-directed, always sends). Shop A receives NO confirmation/audit email.
3. Toggle OFF. Mark another no-show.
4. **Expected (current/buggy):** Same — customer gets warning, shop gets nothing.

---

## Section 6: Customer-Facing Emails (Always Send — Do NOT Gate on Shop Preferences)

These emails go to the customer, not the shop. Shop preferences should NEVER suppress them.

### Test 6.1: Booking confirmation to customer

1. Shop A has ALL preferences toggled OFF.
2. Customer A books and pays for a service at Shop A.
3. **Expected:** Customer A receives booking confirmation email. Shop A's preferences do not affect this.

### Test 6.2: Customer cancellation notice

1. Shop A has Booking Cancellation toggled OFF (and all other toggles OFF for good measure).
2. Shop A cancels a Customer A booking.
3. **Expected:** Customer A receives "Your booking was cancelled by the shop" email. Shop preferences are not consulted.

### Test 6.3: Customer no-show warning

1. Shop A has No-Show Alert toggled OFF.
2. Shop A marks Customer A as no-show.
3. **Expected:** Customer A receives the tier-appropriate no-show warning email (Tier 1 / 2 / 3 / 4 depending on their cumulative count). Shop preferences do not affect this.

### Test 6.4: Customer appointment reminder

1. Shop A has Appointment Reminder toggled OFF.
2. Customer A has a booking tomorrow.
3. **Expected:** Customer A still receives their 24-hour-before reminder email (gated on the *customer's* own `general_notification_preferences.email_enabled`, not the shop's preference).

---

## Section 7: Edge Cases & Failure Modes

### Test 7.1: Shop email address missing or invalid

1. Set Shop A's email to NULL or malformed value directly in DB.
2. Trigger a new-booking event.
3. **Expected:** Email dispatcher logs a warning or skipped-send record. Customer still gets their confirmation. Booking still succeeds.

### Test 7.2: Email provider temporarily down

1. Simulate email provider failure (block SMTP outbound, misconfigure API key, etc.).
2. Trigger a new-booking event with all toggles ON.
3. **Expected:** Email send fails gracefully. Error logged server-side. Booking transaction does NOT roll back. Customer's confirmation may also fail but the business action succeeds.
4. Restore email provider. Trigger another event.
5. **Expected:** Subsequent emails resume normally. No queued retries of the earlier failed email (unless the system has a retry queue — document whichever behaviour is observed).

### Test 7.3: Preferences row missing for an existing shop

1. Delete Shop A's row from `email_preferences` directly.
2. Trigger a new-booking event.
3. **Expected:** System creates defaults on-demand OR treats missing row as "all ON" / "all OFF" per spec. Document which. Email behaviour consistent with that choice.
4. Navigate to the Emails UI.
5. **Expected:** UI renders without crashing; on-demand defaults appear or a fresh default row is created.

### Test 7.4: Rapid toggle changes

1. Toggle New Booking ON → OFF → ON → OFF → ON rapidly (within 1 second).
2. **Expected:** Final state (ON) persists correctly. No stale updates. No race where the DB lands in the wrong state.
3. Reload page — confirm final state.

### Test 7.5: Preference change mid-event

1. Trigger a new-booking event that will take several seconds to fully process.
2. Immediately toggle New Booking OFF while the email is being composed/sent.
3. **Expected:** Behaviour should be consistent — either (a) preference check at event-queue time, email fires, or (b) preference check at send time, email skipped. Document and standardise on one. A mid-flight race where the email fires *but* the DB shows OFF is a bug.

### Test 7.6: Concurrent edit by different admin sessions

1. Log into Shop A from two browsers / two devices.
2. In session 1, toggle New Booking OFF. Save.
3. In session 2 (unrefreshed), toggle New Booking ON. Save.
4. **Expected:** Last-write-wins. Refresh session 1 — final state matches session 2's save.
5. No corruption of unrelated toggles.

---

## Section 8: Observability

### Test 8.1: Preference changes are logged

1. Toggle any preference ON or OFF.
2. Check server logs (or audit table if one exists).
3. **Expected:** A log line or audit row shows shopId, preference key, old value, new value, timestamp, actor (wallet/user id). Used for support debugging.

### Test 8.2: Preference-gated sends are logged

1. Toggle New Booking OFF. Trigger a new booking.
2. **Expected:** Log line like `"Email suppressed by preference: newBooking, shopId=..., recipient=..."`.
3. Toggle ON. Trigger again.
4. **Expected:** Log line showing `"Email sent: newBooking, shopId=..., recipient=..., messageId=..."`.
5. These logs are essential for answering shop support tickets like "why didn't I get X email?"

---

## Smoke Test (Minimum Coverage)

Run these 6 in sequence if time-boxed:

1. **Defaults:** new shop → Emails tab shows 12 toggles, all ON, row exists in DB with all `true`.
2. **Save + reload:** toggle New Booking OFF → refresh → still OFF.
3. **Real toggle honoured:** toggle New Booking OFF → trigger booking → no email. Toggle ON → trigger another → email arrives.
4. **Customer emails still fire:** set ALL shop toggles OFF → book a service → customer still gets confirmation email.
5. **Phantom toggle produces no email either way:** toggle Booking Cancellation ON → cancel a booking → shop receives no email (expected; bug). Note status of `bug-shop-email-toggles-without-backing-emails` in the ticket.
6. **Subscription Expiring gating works:** set Subscription Expiring OFF → trigger reminder dispatcher → no email. Set ON → re-trigger → email arrives.

---

## Notes

- **Related bugs:**
  - `completed/bug-email-preferences-not-enforced.md` — preference enforcement fix for the 8 working toggles (shipped 2026-04-07).
  - `bugs/21-04-2026/bug-shop-email-toggles-without-backing-emails.md` — the 4 phantom toggles in Section 5. Until that bug resolves, Section 5 tests document expected broken behaviour so QA can spot when it's been fixed.
- **Customer vs shop:** any test in Section 6 that shows a customer NOT receiving an expected email is a regression in the customer-facing email path — file separately under `bugs/` and flag as High, since customers don't have a way to re-send their own confirmation.
- **Template correctness is out of scope for this guide:** this guide tests *whether* an email is sent, not *what it contains*. Template regression testing (correct merge fields, no raw Handlebars tags, mobile-responsive HTML) belongs in a separate template QA guide.
- **SMS / push / in-app:** this guide is email-only. Other notification channels have their own preference keys (`emailEnabled` vs `pushEnabled` vs `inAppEnabled`) and should be tested in a parallel guide.
- **Staging vs production testing:** safe to run Sections 1-7 on staging. Production testing should be limited to Section 1 (read-only defaults check) and Section 8 (observability) — don't toggle real shops' preferences or trigger real emails in prod.
- **Test customer for staging reproduction:** Qua Ting (`0x6cd036477d1c39da021095a62a32c6bb919993cf`) + peanut shop make a convenient pair — Qua Ting is peanut's home customer with a rich booking history suitable for exercising every event type.
