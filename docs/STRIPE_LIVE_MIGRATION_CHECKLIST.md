# Stripe Live Migration — Setup & Cutover Checklist

> Moving FixFlow from the current (test) Stripe account to a **separate live account**.
> Nothing carries over: keys, products, prices, webhooks, customers, subscriptions and
> connected accounts are all account-scoped and must be recreated.

Owner: Nico · Created: 2026-07-29 · Status: **not started**

---

## 0. What this is based on, and the one open question

Derived from a sweep of the codebase (every `process.env.STRIPE*` reference, every
`stripe.*` API call, the webhook switch, and every DB column holding a Stripe id) plus live
queries against the **staging** database.

**Staging is entirely test-mode.** `backend/.env` uses `sk_test_` / `pk_test_`, so every
Stripe object staging references — 31 active subscriptions, 34 canceled, 38 customers, 9
connected accounts — is test data. Nothing there needs preserving.

> ### ⚠️ Open question — decides how much of §3 applies
> **Has production ever run against a live key?** The repo only contains staging config
> (`.do/app.yaml` is `repaircoin-backend-staging`); there is no production env file here, so
> production's Stripe mode is unverified.
>
> Settle it before starting:
> ```bash
> # Production app env — mode only, never paste the value
> echo $STRIPE_SECRET_KEY | cut -c1-8
> ```
> ```sql
> -- Production database
> SELECT status, count(*) FROM stripe_subscriptions GROUP BY status;
> SELECT count(*) FROM shops WHERE stripe_connect_account_id IS NOT NULL;
> ```
> - **Prod is `sk_test_`** → no real Stripe object exists anywhere. This is a clean
>   first-time live setup: §3 reduces to clearing Connect columns and letting shops onboard.
> - **Prod is `sk_live_`** → prod holds real subscriptions and connected accounts, and all of
>   §3 applies to the production database.

---

## 1. Create in the live Stripe account

### 1.1 Products & prices

Six recurring monthly prices. Amounts must match `backend/src/config/subscriptionPlans.ts` —
`getPlanByPriceId` maps price id → tier, so a wrong amount or an unmapped id silently
mis-tiers shops.

| Env var | Product | Amount |
|---|---|---|
| `STRIPE_PRICE_STARTER` | Starter AI | $80 / mo |
| `STRIPE_PRICE_GROWTH` | Growth AI | $299 / mo |
| `STRIPE_PRICE_BUSINESS` | Business AI | $599 / mo |
| `STRIPE_MONTHLY_PRICE_ID` | Legacy plan | $500 / mo |
| `STRIPE_PRICE_AGENCY_BASE` | Agency base | see `AgencyService` |
| `STRIPE_PRICE_AGENCY_EXTRA_CLIENT` | Agency per-extra-client | " |

- [ ] Create all six as **recurring monthly**
- [ ] `STRIPE_MONTHLY_PRICE_ID` is still required — it is the fallback in
      `resolveCheckoutPriceId` and the app throws at boot without it
- [ ] No trial config needed; `TRIAL_PERIOD_DAYS = 14` is code-driven

### 1.2 Connect (platform side)

- [ ] Enable Connect and complete the **platform profile** — Express onboarding will not
      render without it
- [ ] Allow **Express** accounts; the code calls
      `accounts.create({ type: 'express', capabilities: { card_payments, transfers } })`
- [ ] Set **Connect branding** (icon, logo, brand colour, business name) — this is the UI
      shops see inside the embedded `<ConnectAccountOnboarding>` component
- [ ] Confirm the platform may collect **application fees** — direct charges use
      `application_fee_amount`, and refunds use `refund_application_fee`
- [ ] Choose the default payout schedule for connected accounts
- [ ] **Only if keeping the legacy OAuth path:** register a Connect OAuth application for
      `STRIPE_CONNECT_CLIENT_ID` and add the redirect URI

### 1.3 Webhooks — one URL, two endpoints, two secrets

Both point at `POST /api/shops/webhooks/stripe`. `StripeService` verifies against both
secrets (`StripeService.ts:803`).

- [ ] **Platform endpoint** → `STRIPE_WEBHOOK_SECRET`
- [ ] **Connect endpoint** — same URL, "listen to events on connected accounts" →
      `STRIPE_CONNECT_WEBHOOK_SECRET`

Enable every event the app handles, on both endpoints:

```
account.updated
charge.succeeded              charge.updated              charge.refunded
payment_intent.succeeded      payment_intent.payment_failed      payment_intent.canceled
checkout.session.completed
customer.subscription.created customer.subscription.updated
customer.subscription.deleted customer.subscription.trial_will_end
invoice.payment_succeeded     invoice.payment_failed
invoice.payment_action_required   invoice.marked_uncollectible
credit_note.created
```

- [ ] Without the Connect endpoint, booking charges and refunds on connected accounts never
      reconcile — `charge.refunded` fails signature verification and
      `payments.refunded_cents` is never updated

### 1.4 Account activation & presentation

- [ ] Live account activated: business details, platform bank account, tax id
- [ ] Public business name, support email, and statement descriptor on the platform account
      (these reach customer card statements and Stripe receipts)
- [ ] Note: the app never calls `accounts.update` to set a **per-shop statement descriptor**
      (specced in Slice 1.0, not built), so each shop's descriptor comes from what they enter
      during Express onboarding

### 1.5 API version

The SDK pins `apiVersion: '2025-08-27.basil'` (`StripeService.ts:48`).

- [ ] Webhook payload shapes follow the **endpoint's** configured version — either match it to
      the pinned version or verify the reconciler still parses `balance_transaction` and
      `fee_details` correctly

---

## 2. Environment variables

```
STRIPE_SECRET_KEY                     sk_live_…
STRIPE_WEBHOOK_SECRET                 whsec_…   (platform endpoint)
STRIPE_CONNECT_WEBHOOK_SECRET         whsec_…   (Connect endpoint)
STRIPE_MONTHLY_PRICE_ID               price_…
STRIPE_PRICE_STARTER                  price_…
STRIPE_PRICE_GROWTH                   price_…
STRIPE_PRICE_BUSINESS                 price_…
STRIPE_PRICE_AGENCY_BASE              price_…
STRIPE_PRICE_AGENCY_EXTRA_CLIENT      price_…
STRIPE_CONNECT_CLIENT_ID              ca_…      (only if keeping legacy OAuth)
STRIPE_CONNECT_REDIRECT_URI           optional override

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY    pk_live_… ← FRONTEND, easy to miss
```

- [ ] Three throw at boot if missing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `STRIPE_MONTHLY_PRICE_ID`
- [ ] `isTestMode` is derived (`NODE_ENV !== 'production' || key contains 'test'`) and only
      tags Stripe metadata — a live key under a non-production `NODE_ENV` still labels
      everything `test`
- [ ] Keep `ADS_BILLING_STRIPE_ENABLED=false` and `AI_OVERAGE_STRIPE_ENABLED=false` through
      cutover — both charge real cards via `invoices.pay`

---

## 3. Data bound to the old account

Every Stripe id in the database belongs to the old account. Counts below are **staging**
(test data); run the same queries against production and rewrite this table before cutover.

| Object | Staging rows | Disposition |
|---|---|---|
| `stripe_subscriptions` (active/trialing/past_due) | 31 | Cannot move between accounts — recreate |
| `stripe_customers` | 38 | Invalid; new customers created on first charge |
| `stripe_payment_methods` | 1 | Invalid; cards must be re-entered |
| `shops.stripe_connect_account_id` | 9 (3 express, 6 legacy standard, 5 charges-enabled) | Every shop re-onboards — connected accounts don't transfer |
| `agencies.stripe_subscription_id` | 2 | Recreate |
| `payments` / `refunds` / `stripe_events` | 727 / 1 / 13 | Keep as history; ids just won't resolve in the new dashboard |

Other columns holding old-account ids (historical, no action):
`deposit_transactions`, `service_orders.stripe_payment_intent_id/stripe_session_id`,
`stripe_payment_attempts`, `subscription_payment_ledger`, `ai_overage_charges`,
`ad_billing_charges`, `shop_rcn_purchases.payment_reference`.

- [ ] **Never deauthorize the old connected accounts.** It is irreversible and bricks the
      account even in test mode — reset the DB columns instead
- [ ] Clear per shop so Get Paid starts clean: `stripe_connect_account_id`,
      `connect_account_type`, `connect_charges_enabled`, `connect_payouts_enabled`,
      `connect_onboarded_at`
- [ ] Decide subscription handling **before** cutover: `getShopTier` derives tier from live
      subscription state, so wiping subscription rows drops every shop to **free** and
      instantly gates paid features

---

## 4. Cutover sequence

- [ ] Freeze billing: `ADS_BILLING_STRIPE_ENABLED=false`, `AI_OVERAGE_STRIPE_ENABLED=false`
- [ ] Snapshot the database (at minimum every table in §3)
- [ ] Create products, prices, webhooks and Connect config in the live account (§1)
- [ ] Swap env vars: backend (DigitalOcean) **and** frontend (`NEXT_PUBLIC_…`)
- [ ] Deploy; confirm the backend boots with no Stripe config errors
- [ ] Clear the Connect columns (§3); send shop re-onboarding comms
- [ ] Recreate subscriptions, or have shops re-subscribe
- [ ] Re-enable the two billing flags once §5 passes

---

## 5. Verification after cutover

- [ ] `GET /api/payments/_health` returns ok; backend starts clean
- [ ] Webhook deliveries show **200** on both endpoints in the live dashboard
- [ ] A shop completes Express onboarding in-app with no redirect; `account.updated` flips
      `connect_charges_enabled`
- [ ] A booking charge produces a `payments` row with correct `gross_cents`, `fee_cents`,
      `application_fee_cents` (1% / 0.5% by tier), `net_cents`, and `stripe_account_id` =
      the new connected account
- [ ] The ledger invariant holds: `gross − fee − application_fee = net`
- [ ] The application fee lands in the **platform's** live balance
- [ ] A refund from the shop's Payments tab succeeds and `charge.refunded` reconciles
      (`refunds` row `succeeded`, `payments.refunded_cents` updated)
- [ ] A subscription checkout maps to the right tier — confirm `getPlanByPriceId` resolves
      the new price id rather than falling through to the legacy fallback
- [ ] Re-delivering any event is a no-op (the `stripe_events` dedup gate)
- [ ] Admin → Payments (Slice A1) shows the new payments with correct platform fees

---

## 6. Rollback

The old account is untouched by any of this, so rollback is an env-var revert:

- [ ] Restore the previous Stripe env vars and redeploy
- [ ] Restore the database snapshot **if** Connect columns or subscription rows were cleared
- [ ] Any objects created in the live account during the window (connected accounts,
      customers, subscriptions) stay there — they're harmless, but note them so a later
      retry doesn't double-create

---

## Appendix — where this lives in code

| Concern | Location |
|---|---|
| Stripe client, config, webhook verification | `backend/src/services/StripeService.ts` |
| Connect: Express accounts, Account Sessions, legacy OAuth | `backend/src/services/StripeConnectService.ts` |
| Webhook receiver + event switch | `backend/src/domains/shop/routes/webhooks.ts` |
| Fiat ledger reconciliation | `backend/src/domains/PaymentsDomain/services/PaymentReconciler.ts` |
| Tier ↔ price mapping, trial length | `backend/src/config/subscriptionPlans.ts` |
| Application fee by tier (1% / 0.5%) | `backend/src/utils/platformCommission.ts` |
| Embedded onboarding UI | `frontend/src/components/shop/payments/GetPaidOnboarding.tsx` |
