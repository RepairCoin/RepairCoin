# Twilio Toll-Free Verification — Submission Packet (copy-paste ready)

Everything management needs to **resubmit** the toll-free verification for **+1 888 471 5544**, with
every field pre-written to match what is live on `fixflow.ai`.

**Rejection history:** inconsistency (30496) and opt-in (30498), then business email (30482), then —
2026-08-07 — business email again, plus *"Marketing Messages Require Express Written Consent"* and
*"Opt-in — Consent for messaging is a requirement for service"*.

**This version is TRANSACTIONAL ONLY**, because the last two rejections were caused by claiming a
marketing program the product does not have. Read
[`twilio-tollfree-resolution-plan.md`](./twilio-tollfree-resolution-plan.md) before editing anything
here — it explains why, and what has to be built before marketing can be submitted at all.

Two golden rules: **every field below describes the same messaging program and matches the website**
(do not reword one without the others), and **do not add marketing back in.**

---

## How to submit

1. Twilio Console → **Messaging → Regulatory Compliance → Toll-Free Verification** (or the link in the
   rejection email — "Edit the verification via the Messaging Compliance API or Console").
2. Open the **rejected** verification for +18884715544 and **Edit** it (don't create a new one —
   editing keeps you in the **7-day prioritized resubmission** queue).
3. Update the fields with the values below.
4. Attach the opt-in screenshot and paste the policy URLs.
5. Submit.

---

## Business / contact (fixes reason 30482)

| Field | Value |
|---|---|
| Legal business name | **Repaircoin, Inc.** |
| Doing business as / brand | **FixFlow** |
| Business website | **https://fixflow.ai** |
| Business email | **admin@fixflow.ai** ← must be this, not a Gmail or @repaircoin.ai; confirm the inbox receives mail |
| Business address | *[management to fill — the registered company address]* |
| Contact phone | *[management to fill]* |

> Website + email are both on `fixflow.ai`; the legal entity is Repaircoin, Inc. (DBA FixFlow). That
> entity/DBA relationship is normal — keep the legal name as Repaircoin, Inc. everywhere it asks for
> the *legal* name, and FixFlow where it asks for the brand/DBA.

---

## Use case

| Field | Value |
|---|---|
| Use-case category | **Customer Care / Notifications** — NOT "Mixed". See the warning below. |
| Opt-in type | **Web form / online** (the SMS consent toggle in the customer's account) |
| Estimated monthly volume | *[management to fill — a realistic number; toll-free has daily/monthly throughput limits, so don't over-state]* |

> 🔴 **This section was rewritten 2026-08-07 after the third rejection. Do not put marketing back in.**
>
> The previous version declared **Mixed** and said marketing SMS goes to customers who "separately opt
> in". That claim is not true of the product: there is one SMS toggle, for transactional messages, and
> **no separate marketing opt-in exists** — not in the UI, and not in the consent ledger, which records
> a channel (`sms`/`whatsapp`) and not a purpose.
>
> So a reviewer read the claim, looked at our screenshot, found no marketing consent capture, and
> rejected for *"Marketing Messages Require Express Written Consent"*. Rewording will not fix it,
> because the mechanism genuinely is not there.
>
> **Marketing goes in a SEPARATE submission, after the toggle and the ledger `purpose` column are
> built.** See `twilio-tollfree-resolution-plan.md`.

### Use case description  *(free text — paste verbatim)*
> FixFlow sends transactional SMS to customers of the service businesses on our platform: appointment
> confirmations, appointment reminders, repair/service status updates, payment confirmations, one-time
> verification codes, and customer-support replies. Customers opt in via a consent toggle in their
> FixFlow account settings, and can reply STOP to unsubscribe or HELP for help at any time.

### Use case summary  *(free text — paste verbatim; this is the field that must MATCH the description)*
> Transactional messaging for appointment- and service-based businesses on FixFlow: appointment
> confirmations and reminders, service/repair updates, payment confirmations, verification codes, and
> support replies. Customers opt in in their account settings. STOP to unsubscribe, HELP for help.

> ⚠️ The description and summary above deliberately say the **same thing**. If you edit one, edit both.
> Reason 30496 was these two disagreeing.

---

## Opt-in workflow  *(free text — fixes reason 30498; must match the screenshot exactly)*

Paste verbatim:

> Customers opt in to SMS through a consent checkbox in their FixFlow account settings (Notification
> Preferences → "SMS Notifications"). The box is unchecked by default — consent is an affirmative
> action. Directly beneath it, before the customer enables it, we display: the message types
> (appointment confirmations, reminders, service updates), "Message frequency varies", "Msg & data
> rates may apply", "Reply STOP to unsubscribe, HELP for help", and links to our SMS Policy and
> Privacy Policy. Consent is recorded per customer and honored on every send. Customers can withdraw
> consent at any time by turning the toggle off or replying STOP.

**Opt-in evidence to attach:**
- Screenshot: the "SMS Notifications" toggle **with the disclosure text beneath it** (the message
  types, "Msg & data rates may apply", STOP/HELP, and the SMS/Privacy Policy links).
- Opt-in / policy URLs:
  - SMS Policy — **https://fixflow.ai/sms-policy**
  - Privacy Policy — **https://fixflow.ai/privacy-policy**
  - Terms — **https://fixflow.ai/terms**

---

## Sample messages  *(provide these as the production samples — they match the use case above)*

1. **Appointment confirmation** —
   > FixFlow: Your appointment with Downtown Auto Repair is confirmed for Thu Aug 7, 2:00 PM. Reply STOP to opt out, HELP for help.
2. **Appointment reminder** —
   > FixFlow: Reminder — your appointment with Downtown Auto Repair is tomorrow, Aug 7 at 2:00 PM. Reply STOP to opt out.
3. **Service/repair update** —
   > FixFlow: Update from Downtown Auto Repair — your brake service is complete and ready for pickup. Reply STOP to opt out.
4. **Payment confirmation** —
   > FixFlow: Payment of $145.00 to Downtown Auto Repair received. Thank you! Reply STOP to opt out, HELP for help.
> ⚠️ There is deliberately **no marketing sample here**. One was removed 2026-08-07 — a promotional
> example tells the reviewer to look for marketing consent, which is exactly what got this rejected.

> Samples name the business (FixFlow), reflect the stated use case, and carry STOP/HELP — all things
> reviewers look for. Keep at least one showing the opt-out language.

---

## Pre-submit checklist

- [ ] Email = `admin@fixflow.ai` and the inbox receives mail.
- [ ] Category = **Customer Care / Notifications** (NOT Mixed); opt-in type = **Web form/online**.
- [ ] No mention of marketing anywhere — description, summary, opt-in text, or samples.
- [ ] Business email is **admin@fixflow.ai**, and someone has confirmed it receives mail.
- [ ] Use case **description** and **summary** pasted verbatim (they match).
- [ ] Opt-in workflow pasted verbatim; matches the screenshot and the live toggle.
- [ ] The opt-in screenshot (toggle + disclosure) attached; policy URLs = the three fixflow.ai links.
- [ ] Sample messages entered.
- [ ] Volume filled realistically.
- [ ] Editing the **rejected** verification (in the 7-day window), not creating a new one.

## Still needs a human decision / input
- Business **address** + **contact phone** (I don't have these).
- Estimated **monthly volume**.
- **Legal sign-off** on the policy-page copy (already live, drafted — needs approval).
