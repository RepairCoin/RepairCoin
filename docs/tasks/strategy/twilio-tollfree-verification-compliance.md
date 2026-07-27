# Twilio Toll-Free Verification — Compliance Strategy

Twilio rejected the toll-free verification of **+18884715544** (RepairCoin, Inc. / FixFlow) with three
reason codes. This is a documentation/compliance failure, not a business-eligibility one — Twilio's
own email says so ("they're not saying your business is ineligible"). It blocks every SMS feature that
depends on the number (platform SMS, shop-comms rebilling, AI auto-reply channel expansion).

There is a **7-day prioritized resubmission window** from the rejection; after that the submission
"expires" and re-review drops to new-submission turnaround. Treat that as the clock.

---

## The three reason codes, decoded by who fixes them

| Code | Twilio's complaint | Fix | Owner |
|---|---|---|---|
| **30482** | Business email must use an official domain (a Gmail/personal address was used) | Use `admin@repaircoin.ai` (or support@/legal@) in the submission | Management (submission field) |
| **30496** | Use case and use-case summary are inconsistent | One canonical use-case paragraph, pasted identically into every field | Management (copy) — **draft below** |
| **30498** | Opt-in workflow must match the submission | A real, explicit SMS opt-in on the site + policy pages Twilio can read | **Engineering** — the actual blocker |

30482 and 30496 are submission edits. **30498 is why management is stuck**: the website doesn't yet
contain the opt-in evidence the submission has to point at.

---

## Root cause of 30498 (grounded in the code)

- `privacy-policy` and `terms` pages exist. **Terms** already carries some SMS language ("consent to
  receive", "Message and data rates", "opt in", "SMS"); **Privacy Policy** barely mentions SMS.
- **No dedicated SMS/Messaging Policy page.**
- **No explicit SMS opt-in checkbox** anywhere — not in registration, booking, settings, or marketing.
- The backend consent ledger exists and is well-shaped: `customer_messaging_consent` (mig 220),
  keyed by `(phone, channel)`, with a free-form `source`, written via
  `CustomerConsentRepository.grant(phone, channel, source)`. But the only caller is
  `CustomerConsentService.grantOnInbound(...)`, which records **implied** consent —
  `source='inbound_message'`, i.e. "the customer texted us first."

That implied model is exactly what Twilio rejects for this use case. FixFlow's stated messaging is
**proactive** (appointment confirmations, reminders, updates that FixFlow *sends*). "They texted
first" only justifies *reactive replies*. Twilio needs the **affirmative opt-in** that authorizes the
proactive messages — and there is no such checkbox today.

**Good news:** the ledger already supports it. The explicit opt-in only needs a UI checkbox that calls
`grant(phone, channel, 'signup_checkbox' | 'booking_checkbox' | 'marketing_optin')`. No new table.

**Key constraint:** consent is **phone-keyed**. The checkbox must live wherever a phone number is
captured — the **booking flow**, **customer settings** (comms preferences), and a **marketing
signup** — not necessarily wallet-based account registration, which may collect no phone.

---

## Strategy — three lanes

### Lane A — Submission fixes (management, no code)
1. Set the business email to `@repaircoin.ai`. **Verify that inbox actually receives mail** — Twilio
   may confirm it.
2. Use the canonical use-case paragraph (below) verbatim in both the use-case and use-case-summary
   fields so 30496 can't recur.

### Lane B — Website / product (engineering — unblocks 30498)
1. **Explicit SMS opt-in checkbox** at the phone-capture points (booking, customer settings; separate
   marketing opt-in). Unchecked by default; on submit-with-checked, call
   `consentService.grant(phone, 'sms', '<source>')`. Store the consent language version alongside it.
2. **New SMS/Messaging Policy page** (`/sms-policy`) — mirrors the existing legal-page pattern.
3. **Strengthen the Privacy Policy** with an SMS section carrying the no-third-party-sharing clause.
4. **Verify STOP/HELP** handling (a global opt-out list exists in the messaging domain — confirm STOP
   honoring + a HELP auto-response).

### Lane C — Resubmit (submission owner)
Once Lane B is live: screenshot the opt-in checkbox in context + the policy pages, attach the links,
resubmit within the 7-day window.

---

## Draft copy (management approves; does not write)

### Canonical use-case paragraph (30496 — paste identically everywhere)
> FixFlow sends transactional SMS to customers of the service businesses on our platform: appointment
> confirmations, appointment reminders, repair/service status updates, payment confirmations, one-time
> verification codes, and customer-support replies. Marketing or promotional SMS are sent only to
> customers who have separately and explicitly opted in. Customers opt in via a checkbox on FixFlow
> when booking a service or in their account settings, and can reply STOP to unsubscribe or HELP for
> help at any time.

### Opt-in checkbox CTA (30498 — the on-site consent language)
> ☐ I agree to receive SMS from FixFlow about my appointments and service (confirmations, reminders,
> updates). Message frequency varies. Msg & data rates may apply. Reply STOP to unsubscribe, HELP for
> help. See our [SMS Policy](/sms-policy) and [Privacy Policy](/privacy-policy).

(Marketing checkbox is a **separate** box: "…marketing and promotional offers…", never bundled with
the transactional one — bundling breaks the "explicit" requirement.)

### Privacy Policy — SMS clause (must be present verbatim in substance)
> **SMS/text messaging.** When you opt in to SMS, we use your mobile number only to send the messages
> you consented to. **We do not sell or share your SMS opt-in, consent, or mobile number with any
> third party for their marketing.** You can opt out anytime by replying STOP. Message and data rates
> may apply.

The no-third-party-sharing sentence is the single most-checked line for toll-free approval — it must
appear in the Privacy Policy, not only the SMS Policy.

### SMS Policy page — required sections
Program name (FixFlow) · message types (the canonical list) · how to opt in (the checkbox) · message
frequency · "Msg & data rates may apply" · STOP to opt out / HELP for help · the no-third-party-sharing
statement · support contact (`support@repaircoin.ai`).

---

## BUILD STATUS (2026-07-27)

- ✅ **SMS Policy page** — `frontend/src/app/sms-policy/page.tsx` (all Twilio-required sections; copy
  pending legal sign-off). Typecheck clean.
- ✅ **Privacy Policy SMS section** — added §11 "SMS / Text Messaging" + the no-third-party-sharing
  clause into §4 Data Sharing (the most-checked spot). Typecheck clean.
- ⏳ **Opt-in checkbox** — NOT built yet; one design decision needed (below).

### Finding that shapes the opt-in build (important)

The customer settings already has an **"SMS Notifications" toggle** (`NotificationPreferences.tsx`,
`smsEnabled`, default off) — but it is a **notification-channel preference** persisted to
`notification_preferences`. Toggling it does **NOT** write to `customer_messaging_consent`, and its
label carries no consent language. So there are two disconnected concepts:

- `smsEnabled` — "do you want SMS notifications" (preference).
- `customer_messaging_consent` — the phone-keyed opt-in the send-path checks and Twilio requires.

**Decision needed — how to present the compliant opt-in:**
- **(A, recommended) Enhance the existing SMS toggle**: add the compliant disclosure copy (message
  types, frequency, rates, STOP/HELP, links to SMS + Privacy Policy) to the "SMS Notifications" row,
  and on enable write `grant(phone, 'sms', 'notification_preferences')` (revoke on disable). Reuses a
  stable, screenshottable settings surface; no new UI concept. Requires the customer's phone in that
  context (settings has it; confirm NotificationPreferences does).
- **(B) Dedicated opt-in checkbox** in the booking flow (where phone is entered), separate from the
  notification toggle. Closer to point-of-consent but touches the critical booking path.

Either way the backend needs a **customer-facing consent endpoint** (none exists today — only the
admin messaging-costs read): `POST /messaging/consent {channel, source}` → `CustomerConsentService`
grant/revoke, keyed to the authenticated customer's phone.

## Engineering build plan (Lane B)

| Deliverable | Where |
|---|---|
| `/sms-policy` page | `frontend/src/app/sms-policy/page.tsx` (clone the `terms/page.tsx` structure + `<Section>` helper, dark theme) |
| Privacy Policy SMS section | `frontend/src/app/privacy-policy/page.tsx` (add the SMS clause section) |
| Opt-in checkbox — booking | the booking flow where phone is entered → on confirm, POST consent |
| Opt-in checkbox — settings | `customer/settings` comms-preferences toggle |
| Marketing opt-in (separate) | marketing signup surface |
| Consent write endpoint | reuse `CustomerConsentService.grant`; add a thin `POST /messaging/consent` (or fold into the booking submit) with `source` |
| STOP/HELP audit | verify `messaging` domain opt-out + HELP reply exist; document for the submission |

No migration — `customer_messaging_consent` (mig 220) already has `source`. This is UI + one write
path + two content pages.

---

## Resubmission checklist (Lane C)

- [ ] Business email is `@repaircoin.ai` and receives mail.
- [ ] Use-case + summary both use the canonical paragraph verbatim.
- [ ] `/sms-policy` live; Privacy Policy has the SMS + no-share clause; Terms SMS language consistent.
- [ ] Opt-in checkbox live and unchecked-by-default at a phone-capture point.
- [ ] Screenshots: the checkbox in context + the three policy pages.
- [ ] Links to Privacy Policy, Terms, SMS Policy in the submission.
- [ ] Opt-in **description in the submission matches the on-site checkbox wording exactly.**
- [ ] Resubmit within the 7-day prioritized window.

---

## Ownership & sequencing

1. **Now (management):** fix the email; confirm the inbox; approve the four copy blocks above.
2. **Engineering (Lane B):** build the two pages + the checkbox/consent write; verify STOP/HELP. Depends
   only on copy sign-off.
3. **Submission owner (Lane C):** assemble evidence, resubmit in-window.

Lanes A and B run in parallel; C waits on both.

## Out of scope

- Turning on `ENFORCE_MESSAGING_CONSENT` (blocking sends without consent) — a separate go-live decision
  once volume justifies it; not required for verification.
- Per-shop dedicated numbers / A2P 10DLC (that's the separate rebilling/KYC track). This is the
  platform toll-free number only.

## Open questions

- Which phone-capture surfaces exist today for customers (booking definitely; does registration collect
  a phone)? Confirms where the primary checkbox lands.
- Is there a HELP auto-responder wired, or only STOP handling? If only STOP, add a HELP reply.
- Is `support@repaircoin.ai` the right published support contact for the SMS Policy?
