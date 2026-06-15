# Engineering Scope — AI Usage Overage Add-On

**Date:** 2026-06-15
**Status:** Scope only — no code written. Standing rule: do not build/commit until exec signs off Section 6.
**Grounded in:** `backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts`, `ai_shop_settings`
(`monthly_budget_usd`, `current_month_spend_usd`, `current_month_started_at`), `services/StripeService.ts`.

**Sheet promise:** *"AI Usage Overage — Usage ×3, pay-as-you-grow (beyond plan limits)."* Pairs with the
SUBSCRIPTION plans (Starter AI $99 / Growth AI $299 / Business AI $599) and their AI allowances
($10 / $30 / $75) — NOT the ads tiers. Depends on the P0 tiered-subscription + per-plan-allowance work.

---

## 1. How AI spend works today (the foundation)

`SpendCapEnforcer` enforces one flat per-shop monthly cap:
- `monthly_budget_usd` (flat **$20** default) = the allowance; `current_month_spend_usd` tracks **actual AI
  inference cost** (USD), incremented by `recordSpend(shopId, costUsd)` after each Claude call.
- `canSpend(shopId)`: **≥70%** → `useCheaperModel: true` (orchestrator switches to Haiku to stretch the
  allowance); **≥100%** → `allowed: false` (**hard-block** — AI stops).
- `maybeRolloverMonth` auto-resets spend to 0 at each calendar-month boundary (lazy, on next call).

Two changes honor the sheet: (1) allowance becomes **per-plan**, (2) the 100% behavior changes from
"hard-block" to "meter + bill" — but only when the shop has opted into overage.

---

## 2. Step 1 — Per-plan allowance (P0 dependency)

`monthly_budget_usd` set by subscription tier instead of the flat $20:

| Plan | Allowance/mo |
|---|---|
| Starter AI $99 | $10 |
| Growth AI $299 | $30 |
| Business AI $599 | $75 |

This rides on the P0 "tiered subscription + per-plan AI allowance" work in `pricing-sheet-vs-code-gap-analysis.md`
(§4 #1/#3). Until tiers exist, overage can be tested against the current flat budget.

---

## 3. Step 2 — Overage behavior (the add-on)

| | Overage OFF (default) | Overage ON |
|---|---|---|
| At allowance limit | AI **hard-stops** (today's behavior) | AI **keeps running** |
| Beyond allowance | — | each extra $1 of **actual** AI cost billed at **3×** ($3) |

**"Usage ×3"** = past the included allowance, the shop pays **3× FixFlow's actual inference cost**. FixFlow's
COGS is the real cost; the 3× is margin + a natural brake on runaway use. Haiku downshift (≥70%) still applies,
so the allowance stretches before overage ever triggers.

**Worked example (Growth, $30 allowance):** shop hits $30 → with overage ON, uses another $5 of actual AI cost
→ billed **$15** (5×3) on the next invoice (FixFlow COGS $5, revenue $15). With overage OFF, AI stops at $30.

---

## 4. Bill-shock protection (recommended, mirrors ads safeguards)

- **Opt-in:** overage is an add-on; a shop that hasn't enabled it keeps today's safe hard-stop at the
  allowance. No surprise charges by default.
- **Optional overage cap:** let the shop set a max overage $ (e.g. "stop at $50 of overage") — a hard ceiling
  above which AI hard-stops even with overage on. Same philosophy as the ads `$800` auto-pause.

---

## 5. Code changes

### 5.1 Schema (new migration — verify next-free NNN per [[feedback-check-migration-number-before-building]])
```sql
ALTER TABLE ai_shop_settings
  ADD COLUMN overage_enabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN overage_multiplier_bps INTEGER NOT NULL DEFAULT 30000  -- 3.0×
    CHECK (overage_multiplier_bps >= 0),
  ADD COLUMN overage_cap_usd        NUMERIC(12,2),                  -- nullable = no cap
  ADD COLUMN current_month_overage_usd NUMERIC(12,4) NOT NULL DEFAULT 0; -- billable overage accrued this month
```
A monthly billing ledger for the charge trail. Either reuse a generic invoice path or a small table:
```sql
CREATE TABLE IF NOT EXISTS ai_overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  period_month DATE NOT NULL,                 -- YYYY-MM-01
  actual_cost_usd NUMERIC(12,4) NOT NULL,     -- FixFlow COGS for the overage portion
  billed_usd NUMERIC(12,2) NOT NULL,          -- actual_cost × multiplier
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invoiced','paid','void')),
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, period_month)
);
```

### 5.2 `SpendCapEnforcer.canSpend` — overage branch
Replace the unconditional hard-block at `spent >= budget`:
```ts
if (spent >= budget) {
  if (!overageEnabled) return { allowed: false, blockReason: 'monthly_budget_exceeded', ... };
  // overage cap (if set) is a hard ceiling above the allowance:
  if (overageCapUsd != null && (spent - budget) >= overageCapUsd)
    return { allowed: false, blockReason: 'overage_cap_exceeded', ... };
  return { allowed: true, useCheaperModel: true, inOverage: true, ... }; // keep Haiku in overage
}
```
`SpendCheckResult` gains `inOverage?: boolean`.

### 5.3 `recordSpend` — accrue billable overage
When the call's cost lands above the allowance, split the portion over the line and accrue:
```ts
// after incrementing current_month_spend_usd:
const overagePortion = Math.max(0, newSpend - budget) - Math.max(0, prevSpend - budget);
if (overagePortion > 0 && overageEnabled) {
  const billed = overagePortion * (multiplierBps / 10000);
  // bump current_month_overage_usd + upsert ai_overage_charges(shop, month) += {actual, billed}
}
```
(Keeps the existing actual-cost increment intact — overage is tracked alongside, not instead.)

### 5.4 Monthly billing
- A nightly/monthly step sums `pending` `ai_overage_charges` → adds them to the shop's invoice via the same
  `StripeService.createImmediateInvoice` path the ads billing uses (or onto the next subscription invoice).
  Gated by the same Stripe master switch so staging stays money-free. Mark `invoiced`/`paid` on success.

### 5.5 Frontend (shop settings + AI usage panel)
- AI-usage widget: show "X of $allowance used" + (when overage on) "overage this month: $Y". A toggle to
  **enable overage** + an optional **overage cap** input. Admin can also set per-shop.

---

## 6. Open decisions (block the build)

1. **Allowance denomination (the big one).** Is $10/$30/$75 **actual inference cost** (what the code tracks —
   generous, overage rarely fires; ✅ recommend for v1) or **retail "value"** (calls marked up before counting
   against the budget — smaller real allowance, more overage revenue, needs a new pricing layer)? This is the
   gap-analysis open decision "real hard allowance vs marketing framing."
2. **Overage multiplier.** Sheet says ×3. Confirm 3.0× (default `overage_multiplier_bps = 30000`), or per-plan.
3. **Ads-AI exemption (interaction — important).** `LeadAIService` currently calls `recordSpend` against the
   shop's `monthly_budget_usd`, so running ads would silently drain the subscription AI allowance. Recommend
   **exempting ads AI** from the subscription allowance (it's already FixFlow COGS billed per-campaign in
   `ad_ai_costs`, Q6). Decision: route ads AI spend to the ad ledger ONLY, not `recordSpend`.
4. **Opt-in + cap defaults.** Confirm overage is opt-in (recommend yes) and whether a default cap is set.
5. **Where overage is billed.** Its own immediate invoice vs. appended to the monthly subscription invoice.

---

## 7. Effort & tests

- **Effort:** ~1.5–2 days (schema + the two `SpendCapEnforcer` branches + accrual + monthly billing reuse +
  settings UI). The enforcer is the core; billing reuses the ads Stripe path.
- **Tests** (the split math is PURE — extract a helper):
  1. spend below allowance → no overage, normal.
  2. spend crosses allowance with overage OFF → `allowed: false` (hard-stop preserved).
  3. spend crosses allowance with overage ON → `allowed: true, inOverage: true`; billed = overage × 3.
  4. partial-crossing call (prev under, new over) → only the over-portion is billed (no double-count).
  5. overage cap reached → `allowed: false, blockReason: 'overage_cap_exceeded'`.
  6. month rollover → overage + spend reset to 0.

Depends on P0 per-plan allowances; can be built/tested against the flat $20 budget first. See
[[project-ai-spend-cap-new-shop]] (lazy default-budget provisioning) and [[project-pricing-alignment-state]].
