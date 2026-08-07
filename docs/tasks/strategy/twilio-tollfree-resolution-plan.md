# Twilio toll-free verification — how to get unblocked

**Written 2026-08-07.** Third rejection for **+1 888 471 5544**. Read this before touching the
submission packet; it explains why the last two attempts failed and what to do differently.

Companions: `twilio-tollfree-submission-packet.md` (the fields to paste),
`twilio-tollfree-verification-compliance.md` (background),
`../test/twilio-tollfree-compliance-test-and-screenshots.md` (screenshots).

---

## The rejection

Three errors on this round:

1. **Business Email Address Must Use an Official Domain**
2. **Marketing Messages Require Express Written Consent**
3. **Opt-in — Consent for messaging is a requirement for service**

Reason 1 is a repeat of 30482. **Reasons 2 and 3 are the same underlying problem**, and it is not a
wording problem — which is why rewording the packet twice has not fixed it.

---

## The actual cause: we are describing a program we have not built

The submitted opt-in text says:

> *"Marketing messages require a separate, distinct opt-in."*

Sample message #5 is a marketing message. **There is no separate marketing opt-in in the product.**

Verified in the code on 2026-08-07:

- `frontend/src/components/customer/NotificationPreferences.tsx` has **one** SMS toggle — "SMS
  Notifications", described as *"Appointment confirmations, reminders & service updates by text"*.
- Its own disclosure promises *"Marketing texts are separate and only sent if you opt in to them"* —
  **a toggle that does not exist anywhere in the product.**
- The consent ledger (`customer_messaging_consent`, `ConsentChannel = 'sms' | 'whatsapp'`) records a
  **channel**, not a purpose. Nothing distinguishes transactional consent from marketing consent, so
  even if a marketing toggle existed there is nowhere to record it separately.

So a reviewer read "marketing requires separate express consent", looked at the screenshot we
attached, found no marketing consent capture, and rejected. **They were right to.** We asked for
approval to send marketing SMS and showed no mechanism for consenting to marketing SMS.

### What is already correct

Worth stating, because it means the gap is narrow and specific rather than systemic:

- The SMS toggle is **unchecked by default** — in the UI (`smsEnabled: false`) *and* in the database
  (`sms_enabled BOOLEAN DEFAULT false`). Consent is an affirmative act, which is the thing most
  submissions actually get wrong.
- The disclosure carries every required element: message types, "Message frequency varies", "Msg &
  data rates may apply", "Reply STOP to unsubscribe, HELP for help", and links to the SMS Policy and
  Privacy Policy.
- The policy pages exist and are live at `fixflow.ai`.

**We do not have a consent problem. We have a scope problem** — the submission claims more than the
product does.

---

## The plan: split the submission

Two attempts at getting transactional **and** marketing approved together have failed. Stop trying.

### Step 1 — resubmit for TRANSACTIONAL ONLY (this week, no code)

Edit the rejected verification (inside the 7-day window, so it stays in the prioritized queue) and
make it describe only what exists today:

- **Remove sample message #5** (the 15%-off marketing example).
- **Remove every mention of marketing** from the use case description, the use case summary and the
  opt-in workflow. Not softened — removed. Any mention invites the reviewer to look for the
  mechanism.
- **Use case category:** customer care / notifications, **not Mixed**. Mixed is what tells a reviewer
  to expect marketing.
- Keep the opt-in workflow text otherwise as-is; it describes the real toggle accurately.
- Attach the same screenshot. It is accurate for a transactional-only program.

This is an honest submission that matches the product exactly, and it unblocks the thing actually
needed now: appointment confirmations, reminders and service updates.

### Step 2 — fix the business email (this week, no code)

The domain is fine: `fixflow.ai` has valid MX records on Google Workspace, checked 2026-08-07. So the
rejection means the address submitted was not on it, or the mailbox is not provisioned.

- Use **admin@fixflow.ai** — not Gmail, not @repaircoin.ai.
- **Send a test message to it and confirm it arrives.** A reviewer may mail it, and a bouncing address
  fails this again.

### Step 3 — build marketing consent properly (next week, code)

Only after Step 1 is approved. Then file marketing as a **separate use case** with its own evidence.

**What has to exist before that submission:**

1. **A second opt-in control**, distinct from the transactional one — "Promotions and offers by text",
   unchecked by default, with express-written-consent wording next to it.
2. **A `purpose` dimension on the consent ledger** (`transactional` | `marketing`). Without it, a
   transactional consent can be used to justify a marketing send — which is the actual TCPA exposure,
   not just a Twilio checkbox.
3. **Enforcement at the send path**, so a marketing send checks marketing consent specifically. A
   column nothing reads is worse than no column: it looks like compliance and is not.
4. **Consent must not be a condition of service.** Declining marketing SMS must leave the account
   fully usable, and the UI must not imply otherwise. This is what rejection reason 3 is pointing at.
5. **A new screenshot** showing the marketing toggle and its disclosure.

Rough size: **M**. The toggle and the migration are small; the send-path enforcement and the audit
trail are the real work.

---

## Why not do it all at once

Tempting, and it is what the last two attempts effectively tried. Three reasons not to:

- **Transactional is what is needed now.** Appointment reminders are blocked on this number today;
  marketing SMS is not blocked on anything urgent.
- **Every resubmission burns a review cycle.** A rejected verification has a 7-day prioritized window;
  after that it queues normally. Submitting something we know is incomplete spends that window.
- **Marketing consent is a legal question, not just a form field.** Getting it wrong exposes the
  company to TCPA claims, which are per-message statutory damages. That deserves its own pass, not a
  paragraph added to a form under time pressure.

---

## Open questions for management

1. **Is admin@fixflow.ai a real, monitored mailbox?** If not, provision it before resubmitting.
2. **Registered business address and contact phone** — still marked *[management to fill]* in the
   packet, and a reviewer will check them against public records.
3. **Who owns the TCPA question for marketing SMS?** Step 3 needs someone to sign off that the
   consent language is sufficient. That is not an engineering decision.
4. **Does marketing SMS still matter?** If the near-term plan is BYO numbers per shop (see
   `shop-comms-rebilling`), the consent model changes — the shop becomes the sender, and consent is
   captured by them, not us. Worth settling before building Step 3 for the platform number.

---

## Status

- [ ] Step 1 — transactional-only resubmission *(this week, no code)*
- [ ] Step 2 — confirm admin@fixflow.ai receives mail *(this week, no code)*
- [ ] Step 3 — marketing consent: toggle, ledger purpose, send-path enforcement *(next week)*
- [ ] Step 4 — separate marketing use-case submission *(after Step 1 approved and Step 3 shipped)*
