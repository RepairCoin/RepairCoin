# Twilio Toll-Free Compliance — Test & Screenshot Guide

Use this to (1) confirm the SMS opt-in and policy pages are working on production, and (2) capture the
exact screenshots Twilio's toll-free verification needs for reason code **30498** (opt-in workflow).

Companion to `docs/tasks/strategy/twilio-tollfree-verification-compliance.md`.

**Production (fixflow.ai) verified live (2026-07-27):** `/sms-policy` → 200 (contains the STOP / rates /
no-share clauses), `/privacy-policy` → 200, `/api/messages/consent` → 401 (deployed + auth-gated).

---

## Prerequisite

A **test customer account with a phone number on its profile.** Consent is phone-keyed — with no
phone, the opt-in correctly refuses (that's Test 3 below). Set the phone in
customer settings → profile, or use an existing customer that has one.

---

## Part A — The screenshots Twilio needs

Take these on production (`https://fixflow.ai`). Full browser window, URL bar visible.

### Screenshot 1 — the opt-in in context (THE key one for 30498)
1. Log in as the test customer.
2. Go to **`/customer?tab=settings`** → the **Appointment Reminders / Notification Channels** card.
3. Capture the **"SMS Notifications" toggle together with the disclosure text** beneath it — it must
   show: message types, "Message frequency varies", "Msg & data rates may apply", "Reply STOP to
   unsubscribe, HELP for help", and the **SMS Policy** + **Privacy Policy** links.
   *This is the single most important image — it's the on-site opt-in the submission describes.*

### Screenshot 2 — the SMS Policy page
Open **`https://fixflow.ai/sms-policy`** and capture the full page (message types, opt-in
method, frequency, rates, STOP/HELP, and the "we do not sell or share… mobile number" statement).

### Screenshot 3 — the Privacy Policy SMS + no-share clause
Open **`https://fixflow.ai/privacy-policy`**, scroll to **§4 Data Sharing** and **§11 SMS /
Text Messaging**, and capture the **"We do not sell or share your SMS opt-in, consent, or mobile
number…"** line. (This is the clause toll-free review checks hardest.)

> The submission's written opt-in description must **match Screenshot 1 word-for-word in substance.**
> Use the canonical copy in the strategy doc.

---

## Part B — Functional test (prove the opt-in records real consent)

The opt-in isn't just UI — enabling it must write to the phone-keyed consent ledger the send path
honors. Verify with the read-only script after each toggle:

```
cd backend && npx ts-node scripts/verify-sms-consent.ts <the-test-phone-e164>
```

### Test 1 — opt IN
1. Customer settings → turn **SMS Notifications ON** → **Save Changes** → expect "saved" toast.
2. Run the script with the customer's phone.
   **PASS:** `sms  GRANTED  source=notification_preferences` → "VERDICT: ✅ GRANTED".

### Test 2 — opt OUT
1. Turn **SMS Notifications OFF** → Save.
2. Re-run the script.
   **PASS:** `sms  REVOKED` → "VERDICT: ⛔ NOT granted". (Row flips to revoked; nothing is deleted.)

### Test 3 — no phone on file (negative case)
1. Use a customer with **no phone** on the profile; turn SMS ON → Save.
   **PASS:** an error toast — *"Add a phone number to your profile before enabling SMS."* — and the
   toggle snaps back off. No consent row is created. (This is correct: you can't consent to texts
   with no number.)

Run with no argument to see all recent opt-ins at once:
```
cd backend && npx ts-node scripts/verify-sms-consent.ts
```

---

## Part C — STOP / HELP (confirm before submitting)

Twilio auto-handles STOP for toll-free, but confirm the platform honors it and answers HELP:
- Text **STOP** from a consented number → expect no further messages (opt-out recorded).
- Text **HELP** → expect a help reply (or confirm one is configured).

If only STOP is wired and HELP is not, note it — it's a small add, tracked as an open question in the
strategy doc.

---

## Result → resubmission

When Part A screenshots are captured and Part B all PASS:
1. Attach Screenshots 1–3 + the three policy-page links to the Twilio submission.
2. Business email = `admin@fixflow.ai` (reason 30482; same domain as the submitted website); confirm the inbox receives mail.
3. Canonical use-case paragraph pasted identically in every field (reason 30496).
4. Resubmit **within the 7-day prioritized window** from the rejection.
