# Engineering Scope — Payments Processing Add-On (Stripe Connect)

**Date:** 2026-06-15
**Status:** Scope only — no code written. Standing rule: do not build/commit until exec signs off Section 7.
**Grounded in:** `backend/src/domains/ServiceDomain/services/PaymentService.ts`
(`createPaymentIntent` @169, the Stripe Checkout path @554), `backend/src/services/StripeService.ts`
(`createPaymentIntent` @374, `refundPayment`/`partialRefund`, `handleWebhook`).

**Sheet promise:** *"Payments Processing — 0.5%–1% per transaction."* FixFlow takes a small platform fee on
each customer→shop service payment. **Biggest / most involved add-on** — it has real compliance weight, not
just code.

---

## 1. Current reality (verified — no Connect)

- Customers pay for services via `PaymentService.createPaymentIntent` → `StripeService.createPaymentIntent`
  (a plain PaymentIntent) **or** a Stripe Checkout session. There is **no `application_fee`, no
  `transfer_data`, no connected account** anywhere — confirmed by grep.
- Today those service payments settle into **FixFlow's own Stripe account** — there is no automatic split to
  the shop and **no platform cut taken**. (Settlement to shops is handled outside this code path.)
- `shops.stripe_customer_id` already exists — but that's the shop **as a customer** (paying the $500/mo
  subscription). Receiving customer money needs a **separate connected-account id** (the shop as a *seller*).

So this add-on does two things: (a) onboard shops as Stripe **connected accounts** so money lands in *their*
Stripe, and (b) take a **0.5–1% `application_fee`** to FixFlow on each charge.

---

## 2. Recommended Connect shape

- **Account type: Express.** Stripe-hosted onboarding/KYC, dashboards, and payout handling — the standard
  marketplace choice. (Standard = shop has full Stripe; Custom = we own all UX + liability. Express is the
  middle, lowest-effort-for-us path.)
- **Charge model: destination charges.** Keep the PaymentIntent on the **platform account** (minimal change to
  the existing flow) and add `transfer_data.destination = <connected acct>` + `application_fee_amount`. Funds
  route to the shop, FixFlow keeps the fee. (Alternative — direct charges via the `Stripe-Account` header —
  shifts dispute liability to the shop but is a bigger rewrite. Destination is the smaller, safer first step;
  liability trade-off is exec Decision #4.)

---

## 3. Schema (new migration — verify next-free NNN per [[feedback-check-migration-number-before-building]])
```sql
ALTER TABLE shops
  ADD COLUMN stripe_connect_account_id  TEXT,                  -- acct_… (seller account)
  ADD COLUMN connect_charges_enabled    BOOLEAN NOT NULL DEFAULT false, -- from account.updated webhook
  ADD COLUMN connect_onboarded_at       TIMESTAMPTZ,
  ADD COLUMN payments_processing_enabled BOOLEAN NOT NULL DEFAULT false, -- the add-on opt-in
  ADD COLUMN platform_fee_bps           INTEGER NOT NULL DEFAULT 75 CHECK (platform_fee_bps BETWEEN 0 AND 1000); -- 75 = 0.75%
```
(0.5–1% = 50–100 bps; default 75. Per-shop overridable; could also be plan-driven.)

---

## 4. Code changes

### 4.1 New `StripeConnectService` (onboarding + account lifecycle)
- `createConnectAccount(shopId)` → `stripe.accounts.create({ type: 'express', ... })`; store `acct_…`.
- `createOnboardingLink(shopId)` → `stripe.accountLinks.create(...)` (the hosted KYC URL the shop completes).
- `getAccountStatus(shopId)` → reads `charges_enabled` / `payouts_enabled` / `requirements`.
- Webhook handling for **`account.updated`** → set `connect_charges_enabled` + `connect_onboarded_at` when
  `charges_enabled` flips true.

### 4.2 `StripeService.createPaymentIntent` (@374) — accept fee + destination
Add optional params and pass them through to `paymentIntents.create`:
```ts
// when the shop is Connect-enabled and the add-on is on:
paymentIntentData.application_fee_amount = Math.round(finalAmountCents * feeBps / 10000);
paymentIntentData.transfer_data = { destination: shop.stripeConnectAccountId };
```
Fee is computed on the **final** charge amount (AFTER RCN redemption — `PaymentService` already computes
`finalAmount`), so we never take a cut of the RCN-discounted portion.

### 4.3 `PaymentService.createPaymentIntent` (@333) + Checkout path (@554)
- Resolve the shop's Connect fields; if `payments_processing_enabled && connect_charges_enabled`, pass
  `feeBps` + `destination` into the StripeService call.
- Checkout session path: set the same under `payment_intent_data.application_fee_amount` +
  `payment_intent_data.transfer_data.destination`.
- **Fallback (Decision #5):** shop not onboarded / add-on off → today's behavior unchanged (no fee, no split).

### 4.4 Refunds — Connect-aware
- `refundPayment` / `partialRefund` need `reverse_transfer: true` and (policy) `refund_application_fee` when
  refunding a destination charge, so a refund also claws back the transferred funds / fee correctly. Add params;
  default `refund_application_fee` per Decision #6.

### 4.5 Frontend
- **Shop settings:** a "Payments Processing" card — enable the add-on → **"Connect your Stripe account"**
  button (opens the Express onboarding link) → status chip (Pending / Active). Show the fee rate.
- **Admin:** per-shop Connect status + fee-rate override; platform-wide "fees collected" read (sum of
  `application_fee` — can come from Stripe reporting or a local ledger if we want our own number).

---

## 5. Interactions / gotchas

- **RCN redemption:** fee is on `finalAmount` (post-RCN), already computed — just feed the right cents in.
- **Subscription vs seller account:** `stripe_customer_id` (subscription payer) and
  `stripe_connect_account_id` (seller) are **different**; don't conflate.
- **Existing in-flight orders:** turning Connect on changes where money settles. Need a cutover plan — new
  orders use Connect once a shop is onboarded; don't retroactively rewrite settled charges.
- **Webhook raw-body:** Connect events arrive on the same Stripe webhook; reuse the existing
  `handleWebhook` + raw-body route, add an `account.updated` case.

---

## 6. Effort & tests

- **Effort:** ~4–6 days (Connect onboarding service + account-link UI + webhook + fee injection in both
  payment paths + Connect-aware refunds + admin status). This is the heaviest add-on; most of it is the
  onboarding/lifecycle plumbing, not the fee math.
- **Tests:**
  1. PURE fee calc: `feeCents = round(finalCents * bps / 10000)` across bps 50/75/100 + rounding edges.
  2. Fee computed on post-RCN `finalAmount`, not gross.
  3. Add-on OFF or shop not onboarded → no `application_fee`/`transfer_data` (fallback path).
  4. Refund of a destination charge reverses transfer (+ fee per policy).
  5. `account.updated` with `charges_enabled` → flips `connect_charges_enabled`.

---

## 7. Open decisions (block the build)

1. **Compliance / legal (the real gate).** Taking a per-transaction cut makes FixFlow a payment facilitator /
   marketplace — money-transmission, ToS, and tax considerations. Needs legal review BEFORE building (mirrors
   the risks-doc §5.7 legal-language caveat). This is the gating decision, not the code.
2. **Fee rate** — 0.5% / 0.75% / 1.0% (default 75 bps)? Flat across shops or plan-driven (e.g. lower fee on
   the $599 Business tier)?
3. **Account type** — Express (recommended) vs Standard vs Custom.
4. **Charge model + dispute liability** — destination charges (platform liable, recommended) vs direct charges
   (shop liable).
5. **Non-onboarded shops** — fall back to today's no-fee flow (recommended, no disruption) or block service
   payments until onboarded?
6. **Refund policy** — does FixFlow refund its `application_fee` on a customer refund (shop-friendly) or keep
   it (covers processing)? 
7. **Opt-in** — add-on is per-shop opt-in (recommended). Default OFF.
8. **Existing settlement** — how shops get paid today, and the cutover so Connect doesn't double-pay or strand
   funds. Needs an ops/finance answer, not just code.

See [[project-pricing-alignment-state]]. This is analysis/scope only — nothing built.
