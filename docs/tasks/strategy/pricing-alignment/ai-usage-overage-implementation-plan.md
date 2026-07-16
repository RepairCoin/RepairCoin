# Implementation Plan — AI Usage Overage (T3.2)

**Feature:** the pricing.jpeg add-on **"AI Usage Overage — Usage ×3, Pay As You Grow"**. When a shop
hits its monthly AI allowance, instead of being stuck on the lighter model, it can enable an overage
add-on that keeps full-power AI running past the cap, billed at 3× the actual AI cost.

**Maps to:** `T3.2` in the pricing rollout ([pricing-rollout-task-breakdown.md](./pricing-rollout-task-breakdown.md)),
which was deferred behind the WS3 soft-landing (T3.1b). Builds on the shipped per-tier allowances
($10/$30/$75) and the soft-landing cap.

**Status:** SCOPED (this doc). Not started. Author: 2026-07-16.

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
- **D3 — Which usage counts toward overage.** All shop-facing AI that draws on the shop AI budget:
  unified assistant, insights, marketing, image-gen, voice. **EXCLUDED (already exempt from the shop
  cap):** ads-lead AI (billed to `ad_ai_costs`) and — decide — the customer SMS/WhatsApp auto-replies
  (currently they DO draw on the shop cap via `SpendCapEnforcer.recordSpend`). **CONFIRM whether
  off-channel auto-replies count toward overage.**
- **D4 — Billing mechanism.** Accrue overage to a ledger, then invoice via Stripe. This overlaps the
  **Payments/Stripe-Connect add-on (also `coming_soon`, legal-gated D4 of WS0)** — actual charging is
  gated on that path. **Slices 1–2 are buildable now; Slice 3 (charging) waits on Stripe/legal.**
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
- **Migration** (next-free — 221 at time of writing, re-verify): add
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

---

## Slice 3 — Charging via Stripe (GATED on Payments/Stripe path + legal)

- Invoice each month's `pending` overage rows at `amount_cents` via `StripeService.createImmediateInvoice`
  (the same one the ads billing uses), behind master flag **`AI_OVERAGE_STRIPE_ENABLED`** (default off).
  Resolve the shop's `stripe_customer_id`; mark rows `invoiced/paid` + store `stripe_invoice_id`.
- Reconciliation via the existing `invoice.payment_succeeded` webhook (shared with ads billing).
- **Blocked on:** WS0 **D4** (Stripe Connect + legal sign-off) — same gate as the Payments add-on.
  Until then, Slices 1–2 run (behavior + metering) with charging off; the accrual ledger is the record
  to bill from once charging is live.

---

## Cross-cutting

**Flags (all default off):** `ENABLE_AI_OVERAGE` (backend master), `NEXT_PUBLIC_AI_OVERAGE_ENABLED`
(frontend card), `AI_OVERAGE_STRIPE_ENABLED` (charging). Plus the per-shop `ai_overage_enabled` toggle.

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
