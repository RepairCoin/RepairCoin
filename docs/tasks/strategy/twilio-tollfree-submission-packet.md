# Twilio Toll-Free Verification — Submission Packet (copy-paste ready)

Everything management needs to **resubmit** the toll-free verification for **+1 888 471 5544**, with
every field pre-written to match what is live on `fixflow.ai`. The prior rejection was for
inconsistency (30496) and opt-in (30498) — so the golden rule here is: **every field below describes
the same messaging program, and matches the website. Do not reword one field without the others.**

Companion to `twilio-tollfree-verification-compliance.md` (why) and
`../test/twilio-tollfree-compliance-test-and-screenshots.md` (screenshots).

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
| Use-case category | **Mixed** — the program is transactional (appointments/service) **and** opt-in marketing. The website/policies mention marketing, so the category must too, or it re-triggers 30496. |
| Opt-in type | **Web form / online** (the SMS consent toggle in the customer's account) |
| Estimated monthly volume | *[management to fill — a realistic number; toll-free has daily/monthly throughput limits, so don't over-state]* |

### Use case description  *(free text — paste verbatim)*
> FixFlow sends transactional SMS to customers of the service businesses on our platform: appointment
> confirmations, appointment reminders, repair/service status updates, payment confirmations, one-time
> verification codes, and customer-support replies. Marketing or promotional SMS are sent only to
> customers who have separately and explicitly opted in. Customers opt in via a checkbox in their
> FixFlow account settings, and can reply STOP to unsubscribe or HELP for help at any time.

### Use case summary  *(free text — paste verbatim; this is the field that must MATCH the description)*
> Transactional messaging for appointment- and service-based businesses on FixFlow: appointment
> confirmations and reminders, service/repair updates, payment confirmations, verification codes, and
> support replies. Marketing SMS only to customers who separately opt in. STOP to unsubscribe, HELP
> for help.

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
> Privacy Policy. Marketing messages require a separate, distinct opt-in. Consent is recorded per
> customer and honored on every send.

**Opt-in evidence to attach:**
- Screenshot: the "SMS Notifications" toggle **with the disclosure text beneath it** (see the
  screenshot guide, Screenshot 1).
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
5. **Marketing (opt-in only)** —
   > FixFlow: Downtown Auto Repair is offering 15% off oil changes this month. Book in the app. Reply STOP to unsubscribe.

> Samples name the business (FixFlow), reflect the stated use case, and carry STOP/HELP — all things
> reviewers look for. Keep at least one showing the opt-out language.

---

## Pre-submit checklist

- [ ] Email = `admin@fixflow.ai` and the inbox receives mail.
- [ ] Category = **Mixed**; opt-in type = **Web form/online**.
- [ ] Use case **description** and **summary** pasted verbatim (they match).
- [ ] Opt-in workflow pasted verbatim; matches the screenshot and the live toggle.
- [ ] Screenshot 1 (opt-in + disclosure) attached; policy URLs = the three fixflow.ai links.
- [ ] Sample messages entered.
- [ ] Volume filled realistically.
- [ ] Editing the **rejected** verification (in the 7-day window), not creating a new one.

## Still needs a human decision / input
- Business **address** + **contact phone** (I don't have these).
- Estimated **monthly volume**.
- **Legal sign-off** on the policy-page copy (already live, drafted — needs approval).
