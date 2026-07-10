# Square → FixFlow Switch — Customer Migration Campaign Playbook

**Date:** 2026-06-25
**Status:** playbook / strategy. Pairs with `customer-import-migration-plan.md` (the import build).
**Goal:** turn an imported Square customer list into **active FixFlow customers** — claimed accounts,
booking on FixFlow, earning RCN — so the shop can retire Square. Warm migration, consent-first, RCN as
the carrot Square never had.

> Not legal advice. Email marketing follows CAN-SPAM/CASL/GDPR (consent + unsubscribe); **marketing SMS
> needs explicit opt-in (TCPA)** and is excluded from auto-sends here. The shop is the data controller;
> FixFlow is the processor. Keep data per-shop.

---

## Prerequisites
- Import done with **consent + history** (D9): `marketing_email_consent`, `lifetime_spend_usd`,
  `last_visit_at`, `import_source='square'`, `external_ref`.
- **Resend sending domain verified** (currently the blocker) — email rails.
- **Claim flow live** (done/fixed): claim-by-email/phone merges history + RCN into a real account.
- A **welcome/switch RCN incentive** configured (small build if not already — "grant RCN on claim/first booking").

## Audience segments (from the imported data)
- **Subscribed + recent** (`marketing_email_consent = true` AND `last_visit_at` within ~90d) → prime targets.
- **Subscribed + lapsed** (consent true, no visit in 90d+) → win-back.
- **VIP** (top `lifetime_spend_usd`, e.g. top 10–20%) → white-glove offer.
- **No email consent** → **transactional only** (claim/booking confirmations); no marketing blasts.
- **Contactless (skipped at import)** → handled in-store/manually, not in this sequence.

---

## The sequence (~4–6 weeks)

**T0 — Migration announcement (email → subscribed only)**
- Message: "We've upgraded our booking & rewards — meet FixFlow." One-tap **claim your account**
  (history preserved) + **welcome RCN** on claim.
- CTA → claim link / landing page → first FixFlow booking.
- Success: claim rate, first-booking rate.

**T+3–5d — Reminder (email → subscribed non-claimers)**
- "Your rewards are waiting — claim in 1 tap." Re-send only to those who haven't claimed/booked.

**T+1–2wk — Win-back (email → subscribed + lapsed)**
- Stronger comeback offer (bonus RCN or a service discount). Uses FixFlow's lapsed-audience logic +
  the AI campaign drafter.

**T+2–3wk — VIP touch (email → top spenders, optionally a personal call/text *if consented*)**
- Recognize loyalty ("as one of our top customers…"), premium incentive, invite to a tier.

**Ongoing — activation loops**
- **Referral**: invite the migrated base into referral rewards (referrer/referee RCN).
- **Service promos**: target by the services they used to book.
- **Transactional rails**: every FixFlow booking/confirmation reinforces the switch; first booking
  auto-prompts the claim if not done.

**Throughout — retire Square**
- Repoint links/QRs/booking to FixFlow; track migration % via `import_source` + claim/booking activity;
  chase non-migrators; wind Square down once activity has shifted.

---

## Incentives (the pull)
- **Welcome RCN on claim** (low cost, high pull — Square has no equivalent).
- **First-booking-on-FixFlow** discount or bonus.
- **VIP / loyalty tier** seeded from historical spend.
- **Referral** rewards to compound the migrated base.

## Metrics
- **Claim rate** (claimed / emailed-subscribed), **first-FixFlow-booking rate**, **reactivation rate**
  (lapsed who return), **migration %** (active on FixFlow / imported), RCN issued vs. revenue lifted.

## Compliance checklist
- Email **only** `marketing_email_consent = true`; honor unsubscribe on every send; accurate sender +
  physical address (CAN-SPAM). Treat EU/UK/Canada more conservatively (GDPR/CASL).
- **No marketing SMS without explicit opt-in** (TCPA). Phone is for transactional/claim/booking only.
- Per-shop data isolation; shop attests it owns the data; DPA in place. Suppress prior opt-outs.

## What's built vs. needs building
- ✅ Claim flow (merges history + RCN), RCN rewards, AI marketing drafter, lapsed audiences, referral,
  Resend send path.
- ⏳ **Resend domain verification** (blocks email sends), the **import w/ consent+history** (this plan's
  Phase 1+D9), and a small **"grant welcome RCN on claim/first-booking"** hook if not already present.
- 🔭 Optional: a one-click "Switch campaign" template in the AI marketing tool that pre-builds this
  sequence for any shop migrating from another platform.
