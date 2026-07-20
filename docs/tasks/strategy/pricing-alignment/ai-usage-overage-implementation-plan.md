# Implementation Plan — AI Usage Overage (T3.2)

**Feature:** the pricing.jpeg add-on **"AI Usage Overage — Usage ×3, Pay As You Grow"**. When a shop
hits its monthly AI allowance, instead of being stuck on the lighter model, it can enable an overage
add-on that keeps full-power AI running past the cap, billed at 3× the actual AI cost.

**Maps to:** `T3.2` in the pricing rollout ([pricing-rollout-task-breakdown.md](./pricing-rollout-task-breakdown.md)),
which was deferred behind the WS3 soft-landing (T3.1b). Builds on the shipped per-tier allowances
($10/$30/$75) and the soft-landing cap.

**Status (2026-07-20):** Slices 1 (behavior) + 2 (metering) + 2.5 (guardrail + consent) + 2.6 (per-shop
cap, migration 228) BUILT + COMMITTED on `deo/ads-system`. **Slice 3 (Stripe charging) BUILT + test-mode verified (flag OFF)** — the code path
is complete and proven end-to-end against staging Stripe TEST mode; it stays dark until
`AI_OVERAGE_STRIPE_ENABLED=true`, whose real gate is **business/legal sign-off on the "Usage ×3" terms**
(NOT Stripe Connect — it's a direct invoice to the shop's existing `stripe_customer_id`, same as ads billing).

**Slice 3 build (2026-07-20):**
- `AiOverageStripeService` — `invoiceShopPending(shopId)` bundles a shop's completed-month pending overage
  into one Stripe invoice via `createImmediateInvoice` (metadata `kind:'ai_overage_billing'`), marks the
  ledger `paid`/`invoiced`; `invoiceAllDue()` for a monthly run. Gated by `AI_OVERAGE_STRIPE_ENABLED` (501 when off).
- `AiOverageChargeRepository` — `pendingForShop`, `listShopsWithPending`, `markStatus`, `markPaidByInvoiceId`.
- `POST /api/ai/admin/overage-invoice` (admin) — `{shopId}` or `{all:true}`; maps service errors to HTTP.
- `invoice.payment_succeeded` webhook → `reconcileOverageInvoice` flips `invoiced`→`paid` on collection.
- Tests: `AiOverageStripeService.test.ts` (flag/guard/happy/all-due) — part of 881/881 AI-agent green.
- Test-mode run: seeded a last-month pending row → invoice created + auto-collected in Stripe TEST →
  ledger marked, idempotent, cleaned up. **Flag `AI_OVERAGE_STRIPE_ENABLED=false` by default.**

---

## Current state (audited 2026-07-16)

**✅ The "surface" already exists — the framing is 100% built:**
- **Soft-landing cap** — `backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts` `canSpend()`
  never hard-blocks at 100%; it returns `{ allowed: true, useCheaperModel: true, limitReached: true }`
  and the caller runs Haiku-only. Spend is tracked in `ai_shop_settings.current_month_spend_usd`;
  the tier allowance comes from `getShopAiBudget` (WS3).
- **Cap banner** — `frontend/src/components/shop/AiLimitNotice.tsx` renders inside the unified
  assistant + insights + marketing + image-gen panels: *"…upgrade your plan or add AI Usage overage"*
  with a CTA to the Plans & Billing hub (`/shop?tab=plans`).
- **Add-on declared** — `frontend/src/config/addonRegistry.ts` has `ai_overage` ("Usage ×3", toggle,
  ctaLabel "Enable").

**❌ The mechanism does NOT exist — the feature is ~0%:**
- `frontend/src/services/api/addons.ts` hardcodes `ai_overage: 'coming_soon'` → the card renders
  **disabled**; a shop cannot enable it.
- **No per-shop overage flag**, no enable/disable endpoint.
- `SpendCapEnforcer` has **zero overage logic** — even if a shop "enabled" it, they'd still be
  Haiku-capped at 100%.
- **No metering** of spend beyond the allowance; **no "Usage ×3" computation**; **no charge**.

**Net:** everything a shop *sees* is there; nothing that *does* overage exists.

---

## Decisions to lock before building

- **D1 — Ceiling?** The sheet says "pay as you grow" → **no hard ceiling; unlimited past the cap,
  metered and billed 3×.** (Recommended.) A safety ceiling (e.g. Nx the allowance with an alert) can be
  added later as a runaway guard. **CONFIRM.**
- **D2 — What "Usage ×3" bills.** The shop pays **3× the actual FixFlow AI cost of the spend that
  occurred BEYOND the allowance**. (Not 3× total; only the overage portion.) e.g. Growth $30 allowance,
  $34 actual spend → $4 overage → billed **$12**.
- **D3 — Which usage counts toward overage. ✅ DECIDED 2026-07-20.** All shop-facing AI that draws on the
  shop AI budget counts: unified assistant, insights, marketing, image-gen, voice, **and customer SMS/WhatsApp
  auto-replies** (they consume real Claude tokens for a paid Business feature → they count, via
  `SpendCapEnforcer.recordSpend`; this is the existing behavior — no change). **EXEMPT:** **ads-lead AI**
  auto-reply (`LeadAutoAnswerService`) is FixFlow COGS in `ad_ai_costs`, NOT the shop budget — it's covered by
  the flat **AI Ads Management** add-on fee ($199–$999/mo), so lead replies **never** consume the allowance or
  trigger overage. Only the AI **token** cost counts; the Twilio/WhatsApp **carrier** fee is a separate ledger
  (`customer_messaging_costs`) and a separate who-pays decision (D5 of the channel-expansion scope), not overage.

  **Billing model (the two "auto-replies" are separate products, no double-charge):**
  - *Lead auto-reply* → AI Ads Management add-on (flat fee, AI absorbed as COGS) → **not metered to the shop**.
  - *Customer/general auto-reply + in-app AI* → Business plan allowance → **metered; overage past the allowance**.
  Each message runs exactly one path, so there's no conflict. UI labels added (add-on card + AI-usage caption)
  so shops see the distinction.
- **D4 — Billing mechanism.** Accrue to a ledger (Slice 2), then invoice via `StripeService.
  createImmediateInvoice` — a DIRECT invoice to the shop's existing `stripe_customer_id` (from the $500
  subscription). **This does NOT need Stripe Connect** (Connect = the Payments add-on / customer payments +
  payouts, a different thing). The real gate on charging is **business/legal sign-off on the Usage ×3
  terms** + a card-on-file + the bill-shock cap (Slice 2.5). Slices 1/2/2.5 are all buildable now.
- **D5 — Model while in overage.** When overage is ON and past the cap, restore the **full model**
  (Sonnet/default), not Haiku — that's the value the shop is paying for. Below the cap, unchanged.
- **D6 — Who can enable.** Shop self-serve toggle (activationType `toggle`), gated to tiers that have a
  metered allowance (all paid tiers). Optionally require the shop to have a Stripe customer / payment
  method before enabling (ties to D4).

---

## Slice 1 — Enable flag + enforcer honors it + real toggle (BUILDABLE NOW, no Stripe)

Makes the banner's promise real for *behavior*: enabling overage restores full-power AI past the cap.
Metering/charging come in Slices 2–3, so ship Slice 1 behind a flag with charging still off.

**Backend:**
- **Migration 224** (`ai_overage_enabled`; originally 221, renumbered after main's Agency Program merge): add
  `ai_shop_settings.ai_overage_enabled BOOLEAN NOT NULL DEFAULT false`.
- `SpendCapEnforcer.canSpend`: read `ai_overage_enabled`. When spend ≥ 100% **and** overage enabled →
  return `{ allowed: true, useCheaperModel: false, limitReached: true, overageEnabled: true }` (full
  model, flagged as overage). When ≥ 100% and NOT enabled → unchanged (Haiku soft-landing). Extend
  `SpendCheckResult` with `overageEnabled?: boolean`.
- New `AiOverageController` (or extend the AI settings controller): `POST /api/ai/overage/enable` /
  `/disable` (shop-scoped via JWT; gated to metered tiers). Reads/writes `ai_shop_settings`.
- Gate the whole path behind flag **`ENABLE_AI_OVERAGE`** (default off) so it's inert until ready.

**Frontend:**
- `services/api/addons.ts`: resolve `ai_overage` status from the real per-shop flag (off/active)
  instead of hardcoded `coming_soon`, when `NEXT_PUBLIC_AI_OVERAGE_ENABLED` is on.
- Wire the Plans-hub `ai_overage` card `toggle` → the enable/disable endpoint.
- `AiLimitNotice`: when overage is already enabled, change copy to "AI Usage overage is on — full-power
  AI restored" (no CTA), else keep the current upgrade/enable CTA.

**Tests:** `SpendCapEnforcer` (overage on + ≥100% → full model, not Haiku; off → Haiku unchanged;
below cap unchanged); enable/disable endpoint (tier gate, flips the flag).

---

## Slice 2 — Overage metering ledger (Usage ×3 computable) — BUILDABLE NOW

Records how much overage each shop accrues so the 3× charge is computable, without yet charging.

- **Migration:** `ai_overage_charges` (shop_id FK, period_month DATE, overage_cost_cents NUMERIC(12,4)
  [the actual cost beyond the allowance], multiplier NUMERIC default 3.0, amount_cents [= overage×3],
  status `pending|invoiced|paid|void`, stripe_invoice_id, created/updated). Mirrors the ads
  `ad_billing_charges` pattern (migration 151).
- On `recordSpend`, when the post-increment spend crosses/exceeds the allowance **and** overage is
  enabled, accrue the marginal cost beyond the cap into the current month's row (idempotent upsert per
  shop+month; `amount_cents = overage_cost_cents × 3`). Reuse the ads `BillingChargeRepository` shape.
- Admin read: fold overage totals into the existing **AI Messaging Costs**-style admin view or the AI
  spend admin tab (per-shop overage $ this month).
- **Tests:** accrual math (marginal-beyond-cap only, ×3), idempotency per month, no accrual when
  overage off.

> **Status: Slices 1 + 2 BUILT + COMMITTED** on `deo/ads-system` (`d260d5258`, `69f9f84de`), migrations 224/225
> (renumbered from 221/222 after a merge with main's Agency Program, which took 221/222).

---

## Slice 2.5 — Bill-shock guardrail + consent-at-enable (BUILT, no legal gate)

Two of Slice 3's prerequisites are buildable now (they're safety/consent, not charging) and de-risk the
sign-off conversation:
- **Monthly overage guardrail.** A per-shop cap on the *billable* overage (`AI_OVERAGE_MONTHLY_CAP_USD`).
  `SpendCapEnforcer.canSpend` computes billable = `(spent − allowance) × 3` (no extra query — it already
  has spent+allowance); once it reaches the cap, overage STOPS lifting the model (reverts to the Haiku
  soft-landing) so a runaway session can't produce a surprise invoice. `SpendCheckResult` gains
  `overageCapReached`.
- **Consent-at-enable.** `POST /api/ai/overage` requires `consent:true` to ENABLE (not to disable) and
  stamps `ai_shop_settings.ai_overage_consent_at` (audit trail — proof of agreement to "Usage ×3").
  The Plans-hub toggle shows a confirmation dialog stating the terms before enabling.

---

## Slice 2.6 — Per-shop overage cap (BUILT 2026-07-20)

Slice 2.5 shipped a single **platform-wide** guardrail (env `AI_OVERAGE_MONTHLY_CAP_USD`). That made the
cap-reached banner's *"raise your overage cap"* CTA a promise with no control behind it — the only way to
raise the cap was an engineer editing an env var. This closes that gap with the per-shop cap the scope
originally specified (`ai-usage-overage-scope.md` §4/§5.5).

- **Schema.** Migration **228** — `ai_shop_settings.overage_cap_usd NUMERIC(12,2)` nullable. `NULL` =
  inherit the platform default; a positive value = that shop's ceiling on billable overage.
- **Enforcer.** `effectiveOverageCapUsd(perShopCap)` = the shop's own cap if set, else the platform
  default. `SpendCapEnforcer.canSpend` reads `overage_cap_usd` (no extra query) and uses it in the
  guardrail branch. Existing behavior unchanged when a shop hasn't set one.
- **Endpoint.** `POST /api/ai/overage/cap` (shop, gated by `ENABLE_AI_OVERAGE`): `{ capUsd: number|null }`
  — positive sets, `null` clears (inherit default), 0/negative → 400. `GET /api/ai/spend` now returns
  `overageCapUsd` + `overageCapDefaultUsd`.
- **UI.** An "Overage safety cap" input on Plans & Billing (under the overage indicator, shown while
  overage is on): `$___` + Save, placeholder = default, "In effect: $X (default)" hint. The cap-reached
  banner's "Manage overage" button routes here — the CTA now adjusts a real control.
- **Tests.** Enforcer (per-shop overrides default; higher per-shop beats a low default; null inherits) +
  controller (409 flag-off, 400 non-positive, sets rounded-to-cents, clears to null). Part of 889/889 green.
- **Admin override:** not built — a shop self-serves its own cap; an admin-set-per-shop control can reuse
  the same column later if needed.

---

## Prod-hardening (items 5–13, BUILT 2026-07-20)

Everything below is built + committed on `deo/ads-system`, migration **229** applied to staging, live-verified.
Flags default off; nothing charges until `AI_OVERAGE_STRIPE_ENABLED=true`.

- **#5 Monthly cron** — `AiOverageBillingScheduler` (node-cron `0 6 1 * *`, isRunning lock, singleton),
  started/stopped in `app.ts`. Gated by `AI_OVERAGE_STRIPE_ENABLED` (invoiceAllDue no-ops when off).
- **#6 Failed-payment auto-disable** — webhook `invoice.marked_uncollectible` → mark rows `uncollectible`
  + set `ai_overage_enabled=false` (revert to soft-landing, **never a hard AI cutoff**) + notify the shop.
  `invoice.payment_failed` → structured alert log + "we'll retry" notification.
- **#7 Overage-started notification** — `SpendCapEnforcer.recordSpend` fires `ai_overage_started` on the
  single call that crosses the allowance (injectable, best-effort). Registry entries added for
  `ai_overage_started` / `ai_overage_payment_failed` / `ai_overage_disabled` (persist+ws+push, transactional).
- **#8 AI-usage display fix** — `getAiUsageSummary` reads `/ai/spend` (tier allowance via `getShopAiBudget`),
  not the inert stored `monthly_budget_usd`, so the Plans bar matches the enforcer.
- **#9 Approaching-cap warning** — Plans & Billing shows an amber note at ≥80% of the effective cap.
- **#10 Monitoring** — failed invoices logged with `alert: 'ai_overage_*'` tags for log-based alerting;
  the admin "Ready to invoice" card surfaces anything still pending.
- **#11 Concurrency guard** — migration 229 `invoicing_at`; `claimPendingForShop` atomically claims rows,
  a concurrent run (admin double-click / cron overlap) gets nothing → **no double-charge**; release-on-failure.
- **#12 Multi-currency** — overage bills **USD** (`createImmediateInvoice` forces it) as a FixFlow platform
  fee, matching the ads decision (shop ad money uses `meta_currency`; platform fees don't). Documented, no code.
- **#13 Ledger refund tracking** — migration 229 `refunded_cents`/`refunded_at`; webhook `credit_note.created`
  → `recordRefundByInvoiceId` records the reversal + status `refunded`.

Tests: enforcer crossing-notify + guardrail/cap, service claim/release/skip, scheduler gate — 898/898 green.
Live-verified against staging: claim/in-flight-exclusion/release/uncollectible/refund (7/7).

---

## Slice 3 — Charging via Stripe (the real remaining gate = terms sign-off, NOT Connect)

**Correction:** charging a shop for overage is FixFlow **invoicing its own customer** — it does NOT need
Stripe Connect (Connect is for the Payments add-on: shops accepting *their* customers' payments/payouts).
The direct-invoice path already exists and is proven by the ads billing.

- Invoice each month's `pending` `ai_overage_charges` rows at `amount_cents` via
  `StripeService.createImmediateInvoice` (same call the ads billing uses), behind **`AI_OVERAGE_STRIPE_ENABLED`**
  (default off). Resolve the shop's `stripe_customer_id` (shops already have one from the $500 subscription);
  mark rows `invoiced/paid` + store `stripe_invoice_id`. Reuse `AdBillingStripeService.invoiceShopPending` as
  the template + a monthly runner + the shared `invoice.payment_succeeded` webhook for reconciliation.
- **Prereq (card on file):** require a saved payment method before enabling overage (add to Slice 2.5's
  consent gate once wired) so a charge never fails.
- **The actual gate = business/legal sign-off on the TERMS**, not Stripe Connect:
  1. Enable-time consent/disclosure (Slice 2.5 delivers the mechanism)
  2. The bill-shock cap (Slice 2.5 delivers it)
  3. A refund/dispute policy for overage charges
  4. Confirm monthly cadence + card-required-to-enable
  Once signed off, Slice 3 is a small build reusing the ads billing pattern — no new external infra.

---

## Cross-cutting

**Flags (all default off):** `ENABLE_AI_OVERAGE` (backend master — the ONLY visibility gate; there is no
`NEXT_PUBLIC_*` flag, removed so a Vercel env change alone can't leave the card stuck "Coming soon"),
`AI_OVERAGE_STRIPE_ENABLED` (charging). Plus `AI_OVERAGE_MONTHLY_CAP_USD` (platform-default cap),
`AI_OVERAGE_REQUIRE_CARD`, the per-shop `ai_overage_enabled` toggle, and per-shop `overage_cap_usd`.

**Reuse (proven patterns in-repo):** ads billing (`ad_billing_charges`, `BillingChargeRepository`,
`AdBillingService.accrue`, `AdBillingStripeService.invoiceShopPending`, `StripeService.createImmediateInvoice`)
is a direct template for Slices 2–3. The WS3 tier-allowance + soft-landing is the foundation for Slice 1.

**Rollout order:** Slice 1 (behavior) → Slice 2 (metering) → confirm numbers against real usage →
Slice 3 (charging, when Stripe/legal clears). Slice 1 alone already makes the banner honest for the
*experience* (full-power AI when enabled); enable charging before advertising it as billable.

## Open questions / gates
- D1 ceiling, D3 (do off-channel auto-replies count?), D6 (require payment method to enable?) — confirm.
- Slice 3 is gated on Stripe Connect + legal (WS0 D4). Slices 1–2 are not.
- Runaway protection: a per-shop monthly overage alert/soft-ceiling is recommended before charging is
  live (avoid bill shock), even under "unlimited pay-as-you-grow".
